const { format, subHours, addHours } = require("date-fns");

const useNear = require("./near");
const parser = require("./parser");
const PostgresClient = require("../db/PostgresClient");
const client = new PostgresClient();

const bucketsql = `CREATE TABLE IF NOT EXISTS ${client.schema}.balance_bucket (
  bucket TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  status integer NOT NULL DEFAULT 0,
  tx_count integer NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket, chain_id)
);`;

async function main() {
  const { conf } = await useNear();
  await client.connect();
  await client.query(bucketsql);

  const chains = parser.chains(conf);
  if (chains.length === 0) {
    console.error("No chains found with networkType 'near' or 'evm'");
    return;
  }

  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;

  const buckets = [
    subHours(new Date(now.getTime() + offset), 1),
    new Date(now.getTime() + offset),
    addHours(new Date(now.getTime() + offset), 1),
  ].map((d) => format(d, "yyyyMMddHH0000"));
  const values = chains.flatMap((chain) =>
    buckets.map((bucket) => [bucket, chain.chainID]),
  );

  const placeholders = values
    .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
    .join(", ");
  const params = values.flat();

  const sql = `INSERT INTO ${client.schema}.balance_bucket (bucket, chain_id)
    VALUES ${placeholders}
    ON CONFLICT (bucket, chain_id) DO NOTHING;`;
  await client.query(sql, params);
}

module.exports = main;

if (__filename === require.main.filename) {
  main()
    .catch((error) => {
      console.error("backend.balance.bucket: ", error);
    })
    .finally(() => client.disconnect());
}
