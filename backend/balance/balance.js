const _ = require("lodash");
const BigNumber = require("bignumber.js");
const conf = require("./config");
const parser = require("./parser");
const PostgresClient = require("../db/PostgresClient");
const client = new PostgresClient();

const balancesql = `CREATE TABLE IF NOT EXISTS ${client.schema}.balance (
  bucket TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  balance TEXT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket, wallet_address, chain_id)
);`;

const balancehistorysql = `CREATE TABLE IF NOT EXISTS ${client.schema}.balance_history (
  transaction_hash TEXT NOT NULL PRIMARY KEY,
  bucket TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  amount TEXT NOT NULL DEFAULT 0,
  block_timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);`;

const MULTIPLIER_MAP = {
  "0x5448dd0f4c23b4bed107869be9c14ffd7f38c6c3ded0eced40ef6ff7b8f3fc05": 1,
  "0xb8bdadb84da719b84d72f39a7dabc240534c4575a5ed3fe75269c19caa11aaed": -1,
  mint_deposit: 1,
  burn_redemption: -1,
};

async function main(start, end) {
  try {
    await client.connect();
    await client.query(balancesql);
    await client.query(balancehistorysql);
    await calculateAll(start, end);
  } finally {
    await client.disconnect();
  }
}

async function calculateAll(start, end) {
  const { buckets, from, to } = parser.bucketFromRange(start, end);
  const chunks = _.chunk(buckets, 30);
  for (let chunk of chunks) {
    console.log(`[${from} - ${to}] ${chunk.map((c) => c.bucket)}`);

    const placeholders = chunk.map((_, i) => `$${i + 1}`).join(", ");
    const params = chunk.flatMap((c) => c.bucket);

    const { rows } = await client.query(
      `UPDATE ${client.schema}.balance_bucket SET status = 1
        WHERE (bucket, chain_id) IN (
          SELECT bucket, chain_id FROM ${client.schema}.balance_bucket
          WHERE status = 0 and bucket IN (${placeholders})
          ORDER BY bucket, chain_id 
          FOR UPDATE
        )
        RETURNING bucket, chain_id, from_ts, to_ts;`,
      params,
    );

    for (let bucket of rows.sort((a, b) => a.bucket.localeCompare(b.bucket))) {
      await calculate(bucket);
    }
  }
}

async function calculate(bucket) {
  console.log(
    `[${bucket.bucket} - ${bucket.from_ts} : ${bucket.to_ts}] ${bucket.chain_id}:...`,
  );

  const { rows: events } = await client.query(
    `SELECT transaction_hash, chain_id, address AS wallet_address, data, topics, block_timestamp
     FROM ${client.schema}.atbtc_events
     WHERE 1=1
        AND chain_id = $1
        AND block_timestamp >= $2 
        AND block_timestamp < $3
    ;`,
    [
      bucket.chain_id,
      Math.floor(Number(bucket.from_ts) / 1000),
      Math.floor(Number(bucket.to_ts) / 1000),
    ],
  );

  if (events.length === 0) {
    await client.query(
      `UPDATE atlas_uat.balance_bucket
     SET tx_count = $1, status = 2
     WHERE bucket = $2 AND chain_id = $3;`,
      [0, bucket.bucket, bucket.chain_id],
    );
    console.log(
      `[${bucket.bucket} - ${bucket.from_ts} : ${bucket.to_ts}] ${bucket.chain_id}: No events found`,
    );
    return;
  }

  const balances = {};
  const histories = [];
  for (const event of events) {
    const { chain_id, wallet_address, data, topics } = event;

    // Parse the balance from the "data" column (assuming it's hex-encoded)
    const { amount } = parser.log(topics, data);

    const key = `${wallet_address}-${chain_id}`;
    if (!balances[key]) {
      balances[key] = {
        bucket: bucket.bucket,
        wallet_address,
        chain_id,
        balance: new BigNumber(0),
      };
    }
    balances[key].balance = balances[key].balance.plus(amount);

    const mul = parser.multiply(topics);
    histories.push({
      transaction_hash: event.transaction_hash,
      wallet_address,
      chain_id,
      amount: new BigNumber(mul).times(new BigNumber(amount)).toString(),
      block_timestamp: event.block_timestamp,
      bucket: parser.ts2bucket(event.block_timestamp),
    });
  }

  await inserBalance(balances, bucket, events.length);
  await inserHistory(histories);
}

async function inserBalance(balances, bucket, count) {
  const values = Object.values(balances).map((b) => [
    b.bucket,
    b.chain_id,
    b.wallet_address,
    b.balance.toString(),
  ]);
  const placeholders = values
    .map(
      (_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`,
    )
    .join(", ");

  const sql = `INSERT INTO ${client.schema}.balance (bucket, chain_id, wallet_address, balance)
               VALUES ${placeholders}
               ON CONFLICT (bucket, chain_id, wallet_address) DO UPDATE
               SET balance = EXCLUDED.balance;`;

  await client.query(sql, values.flat());

  await client.query(
    `UPDATE atlas_uat.balance_bucket
     SET tx_count = $1, status = 2
     WHERE bucket = $2 AND chain_id = $3;`,
    [count, bucket.bucket, bucket.chain_id],
  );
  console.log(
    `${bucket.bucket} -> ${bucket.chain_id}: Processed ${count} events, updated ${Object.keys(balances).length} balances`,
  );
}

async function inserHistory(histories) {
  const values = histories.map((h) => [
    h.transaction_hash,
    h.wallet_address,
    h.chain_id,
    h.amount,
    h.block_timestamp,
    h.bucket,
  ]);
  const placeholders = values
    .map(
      (_, i) =>
        `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`,
    )
    .join(", ");

  const sql = `INSERT INTO ${client.schema}.balance_history (transaction_hash, wallet_address, chain_id, amount, block_timestamp, bucket)
               VALUES ${placeholders}
               ON CONFLICT (transaction_hash) DO NOTHING;`;

  await client.query(sql, values.flat());
}

module.exports = main;

if (__filename === require.main.filename) {
  main(process.argv[2], process.argv[3]).catch((error) => {
    console.error("backend.balance.balance: ", error);
  });
}
