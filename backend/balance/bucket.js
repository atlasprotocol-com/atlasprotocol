const _ = require("lodash");
const useNear = require("./near");
const parser = require("./parser");
const PostgresClient = require("../db/PostgresClient");
const client = new PostgresClient();

const bucketsql = `CREATE TABLE IF NOT EXISTS ${client.schema}.balance_bucket (
  bucket TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  status SMALLINT NOT NULL DEFAULT 0,
  tx_count INTEGER NOT NULL DEFAULT 0,
  from_ts BIGINT NOT NULL DEFAULT 0,
  to_ts BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket, chain_id)
);`;

async function main(start, end) {
  const { conf } = await useNear();
  await client.connect();
  await client.query(bucketsql);

  const chainIds = parser.chainIds(conf);
  if (chainIds.length === 0) {
    console.error("No chains found with networkType 'near' or 'evm'");
    return;
  }

  const { buckets, from, to } = parser.bucketFromRange(start, end);
  const chunks = _.chunk(buckets, 30);

  for (let chunk of chunks) {
    console.log(`[${from} - ${to}] ${chunk.map((c) => c.bucket)}`);

    const values = chainIds.flatMap((chainId) =>
      chunk.map((bucket) => [
        bucket.bucket,
        chainId,
        bucket.from_ts,
        bucket.to_ts,
      ]),
    );

    const placeholders = values
      .map(
        (_, i) =>
          `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`,
      )
      .join(", ");
    const params = values.flat();

    const sql = `INSERT INTO ${client.schema}.balance_bucket (bucket, chain_id, from_ts, to_ts)
    VALUES ${placeholders}
    ON CONFLICT (bucket, chain_id) DO NOTHING;`;
    await client.query(sql, params);
  }

  await client.disconnect();
}

module.exports = main;

if (__filename === require.main.filename) {
  main()
    .catch((error) => {
      console.error("backend.balance.bucket: ", error);
    })
    .finally(() => client.disconnect());
}
