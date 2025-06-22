const BigNumber = require("bignumber.js");
const useNear = require("./near");
const parser = require("./parser");
const PostgresClient = require("../db/PostgresClient");
const client = new PostgresClient();

const balancesql = `CREATE TABLE IF NOT EXISTS ${client.schema}.balance (
  bucket TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  balance TEXT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket, chain_id, wallet_address)
);`;

async function main() {
  const { conf } = await useNear();
  await client.connect();
  await client.query(balancesql);

  const limit = parser.chains(conf).length;
  const { rows: buckets } = await client.query(
    `UPDATE ${client.schema}.balance_bucket SET status = 1 
     WHERE (bucket, chain_id) IN (
       SELECT bucket, chain_id FROM ${client.schema}.balance_bucket
       WHERE status = 0 
       ORDER BY bucket, chain_id 
       LIMIT $1
       FOR UPDATE
     )
     RETURNING bucket, chain_id;`,
    [limit],
  );

  for (let bucket of buckets) {
    await calculate(bucket);
  }
}

async function calculate(bucket) {
  console.log(`${bucket.bucket} -> ${bucket.chain_id}: ...`);

  const start = Math.floor(parser.bucket2date(bucket.bucket).getTime() / 1000);
  const end = start + 60 * 60; // 1 hour later

  const { rows: events } = await client.query(
    `SELECT chain_id, address AS wallet_address, data
     FROM atlas_uat.atbtc_events
     WHERE 1=1
        AND chain_id = $1
        AND block_timestamp >= $2 
        AND block_timestamp < $3
    ;`,
    [bucket.chain_id, start, end],
  );
  if (events.length === 0) {
    console.log(`${bucket.bucket} -> ${bucket.chain_id}: No events found`);
    return;
  }

  const balances = {};
  for (const event of events) {
    const { chain_id, wallet_address, data } = event;

    // Parse the balance from the "data" column (assuming it's hex-encoded)
    const { amount } = parser.log(data);

    const key = `${chain_id}-${wallet_address}`;
    if (!balances[key]) {
      balances[key] = {
        chain_id,
        wallet_address,
        bucket: bucket.bucket,
        balance: new BigNumber(0),
      };
    }
    balances[key].balance = balances[key].balance.plus(amount);
  }

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
    [events.length, bucket.bucket, bucket.chain_id],
  );
  console.log(
    `${bucket.bucket} -> ${bucket.chain_id}: Processed ${events.length} events, updated ${Object.keys(balances).length} balances`,
  );
}

module.exports = main;

if (__filename === require.main.filename) {
  main()
    .catch((error) => {
      console.error("backend.balance.balance: ", error);
    })
    .finally(() => client.disconnect());
}
