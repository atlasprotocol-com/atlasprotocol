const BigNumber = require("bignumber.js");

const conf = require("./config");
const parser = require("./parser");
const PostgresClient = require("../db/PostgresClient");
const client = new PostgresClient();

const pointsql = `CREATE TABLE IF NOT EXISTS ${client.schema}.point (
  bucket TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  start_ts BIGINT NOT NULL,
  end_ts BIGINT NOT NULL,
  points DECIMAL(20,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket, wallet_address)
);`;

async function distribute(start, end) {
  const { buckets } = parser.bucketFromRange(start, end);

  for (let bucket of buckets) {
    const { rows: snapshots } = await client.query(
      `UPDATE ${client.schema}.point_snapshot SET distribution_status = 1
        WHERE distribution_status = 0 AND distributed_at IS NULL AND bucket = $1
        RETURNING bucket, start_ts, end_ts, points;`,
      [bucket.bucket],
    );

    if (bucket.bucket === "20250628090000") {
      console.log(
        `[${bucket.bucket}] ------------ ${JSON.stringify(snapshots)}`,
      );
    }

    if (snapshots.length === 0) {
      console.log(`[${bucket.bucket}] No snapshots found`);
      continue;
    }

    const totalPoints = snapshots.reduce(
      (sum, snapshot) => sum.plus(new BigNumber(snapshot.points)),
      new BigNumber(0),
    );
    console.log(`[${bucket.bucket}] ${totalPoints} points`);

    // Get all balance changes in the interval
    const { rows: histories } = await client.query(
      `SELECT bucket, wallet_address, amount, block_timestamp FROM ${client.schema}.balance_history
      WHERE bucket = $1
      ORDER BY wallet_address, block_timestamp;`,
      [bucket.bucket],
    );

    console.log(`[${bucket.bucket}] ${histories.length} histories`);

    // Build a map of wallet_address to their balance change events
    const walletMaps = {};
    for (let history of histories) {
      const { wallet_address, amount, block_timestamp } = history;
      if (!walletMaps[wallet_address]) walletMaps[wallet_address] = [];
      walletMaps[wallet_address].push({
        amount: new BigNumber(amount),
        timestamp: Number(block_timestamp) * 1000,
      });
    }

    console.log(
      `[${bucket.bucket}] ${Object.keys(walletMaps).length} wallet maps`,
    );

    // For each user, calculate their weight (balance * minutes held)
    const weights = {};
    let totalWeight = new BigNumber(0);
    for (const [wallet, events] of Object.entries(walletMaps)) {
      // Sort events by timestamp
      events.sort((a, b) => a.timestamp - b.timestamp);
      let weight = new BigNumber(0);
      let lastBalance = await getLastBalacne(wallet, bucket.bucket);
      let lastTimestamp = bucket.from_ts;
      for (const event of events) {
        const duration = (event.timestamp - lastTimestamp) / 60000; // minutes
        weight = weight.plus(lastBalance.times(duration));
        lastBalance = lastBalance.plus(BigNumber(event.amount));
        lastTimestamp = event.timestamp;
      }
      // Add the last segment until bucket.to_ts
      const duration = (bucket.to_ts - lastTimestamp) / 60000;
      weight = weight.plus(lastBalance.times(duration));
      weights[wallet] = weight;
      totalWeight = totalWeight.plus(weight);
    }

    // Apportion points to each user
    for (const [wallet, weight] of Object.entries(weights)) {
      console.log(
        `[${bucket.bucket}] ${wallet} --> ${weight} / ${totalWeight} | ${totalPoints}`,
      );

      const userPoints = totalWeight.isZero()
        ? BigNumber(0)
        : BigNumber(weight).dividedBy(totalWeight).times(totalPoints);

      await client.query(
        `INSERT INTO ${client.schema}.point (bucket, wallet_address, start_ts, end_ts, points)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (bucket, wallet_address) DO UPDATE SET points = EXCLUDED.points;`,
        [
          bucket.bucket,
          wallet,
          bucket.from_ts,
          bucket.to_ts,
          userPoints.toString(),
        ],
      );
      console.log(
        `[${bucket.bucket}] Distributed ${userPoints.toString()} points to ${wallet}`,
      );
    }

    await client.query(
      `UPDATE ${client.schema}.point_snapshot SET distribution_status = 2, distributed_at = NOW(), distribution = $1`,
      [JSON.stringify({ weights })],
    );
  }
}

async function getLastBalacne(wallet, bucket) {
  const { rows: balances } = await client.query(
    `SELECT balance FROM ${client.schema}.balance WHERE wallet_address = $1 and bucket < $2`,
    [wallet, bucket],
  );
  if (balances.length === 0) return BigNumber(0);

  return balances.reduce(
    (sum, { balance }) => sum.plus(new BigNumber(balance)),
    new BigNumber(0),
  );
}

async function main(start, end) {
  try {
    await client.connect();
    await client.query(pointsql);
    await distribute(start, end);
  } finally {
    await client.connect();
  }
}

module.exports = main;

if (__filename === require.main.filename) {
  main(process.argv[2], process.argv[3]).catch((error) => {
    console.error("backend.balance.point_weight: ", error);
  });
}
