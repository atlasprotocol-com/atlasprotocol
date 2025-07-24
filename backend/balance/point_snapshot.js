const conf = require("./config");
const parser = require("./parser");
const PostgresClient = require("../db/PostgresClient");
const client = new PostgresClient();

const POINT_TYPE = {
  ATLAS: 0,
  BITHIVE: 1,
};

const pointsnapshotsql = `CREATE TABLE IF NOT EXISTS ${client.schema}.point_snapshot (
  bucket TEXT NOT NULL,
  type SMALLINT NOT NULL DEFAULT 0,
  start_ts BIGINT NOT NULL,
  end_ts BIGINT NOT NULL,
  points DECIMAL(20,12) NOT NULL DEFAULT 0,
  distributed_at TIMESTAMP WITH TIME ZONE,
  distribution JSONB,
  distribution_status SMALLINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket)
);`;

async function genSnapshot(start, end) {
  const { buckets } = parser.bucketFromRange(start, end);
  for (let bucket of buckets) {
    const points = await getPoints(bucket.from_ts, bucket.to_ts);

    const query = `INSERT INTO ${client.schema}.point_snapshot (bucket, type, start_ts, end_ts, points, created_at)
                   VALUES ($1, $2, $3, $4, NOW())
                   ON CONFLICT (bucket) DO UPDATE SET points = EXCLUDED.points;`;
    await client.query(query, [
      bucket.bucket,
      POINT_TYPE.BITHIVE,
      bucket.from_ts,
      bucket.to_ts,
      points,
    ]);

    console.log(
      `[${bucket.bucket} / ${bucket.from_ts} - ${bucket.to_ts}] ${points}`,
    );
  }
}

async function getPoints(from, to) {
  const input = {
    publicKey:
      process.env.ATLAS_PUBKEY ||
      "02995444b39e3ade9d4d13ba2a6cc61a8e4675d18498c5c46a9ee0b2c99dae4b1a",
    startTimestamp: from,
    endTimestamp: to,
  };
  const baseUrl =
    process.env.ATLAS_BASE_URL || "https://relayer-testnet.bithive.fi";
  const url = `${baseUrl}/user.getPoints?input=${JSON.stringify(input)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch points: ${response.statusText}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`Error fetching points: ${data.error}`);
  }
  const points = Number(data.result.data.points);
  if (isNaN(points)) {
    throw new Error("Invalid points received from API");
  }
  return points;
}

async function main(start, end) {
  try {
    await client.connect();
    await client.query(pointsnapshotsql);
    await genSnapshot(start, end);
  } finally {
    await client.disconnect();
  }
}

module.exports = main;

if (__filename === require.main.filename) {
  main(process.argv[2], process.argv[3]).catch((error) => {
    console.error("backend.balance.point_snapshot: ", error);
  });
}
