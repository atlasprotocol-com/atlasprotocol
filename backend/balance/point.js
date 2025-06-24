const { format, parse } = require("date-fns");

const conf = require("./config");
const PostgresClient = require("../db/PostgresClient");
const client = new PostgresClient();

const pointsnapshotsql = `CREATE TABLE IF NOT EXISTS ${client.schema}.point_snapshot (
  bucket TEXT NOT NULL,
  start_ts BIGINT NOT NULL,
  end_ts BIGINT NOT NULL,
  points DECIMAL(20,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket)
);`;

const HOUR = 60 * 60 * 1000; // 1 hour in milliseconds

async function genSnapshot(start, end) {
  console.log(
    `${new Date(start).toISOString()} - ${new Date(end).toISOString()}`,
  );
  const snapshots = [];

  const { ts: startts } = getCursor(new Date(Number(start)));
  const { ts: endcurts } = getCursor(new Date(Number(end) || Date.now()));
  for (let cur = endcurts; cur >= startts; cur -= HOUR) {
    const { ts: to } = getCursor(new Date(cur));
    const { ts: from, bucket } = getCursor(new Date(to), -1);

    const points = await getPoints(from, to);
    console.log(`[${bucket} / ${from} - ${to}] ${points}`);

    const query = `INSERT INTO ${client.schema}.point_snapshot (bucket, start_ts, end_ts, points, created_at)
                   VALUES ($1, $2, $3, $4, NOW())
                   ON CONFLICT (bucket) DO UPDATE SET points = EXCLUDED.points;`;
    await client.query(query, [bucket, from, to, points]);
    snapshots.push({ bucket, from, to, points });
  }

  return snapshots;
}

function getCursor(date = new Date(), offset = 0) {
  const ts = date.setMinutes(0, 0, 0) + offset * HOUR;
  return { ts, bucket: format(ts, "yyyyMMddHH0000") };
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

async function main() {
  await client.connect();
  await client.query(pointsnapshotsql);
  const start = process.argv[2]
    ? parse(process.argv[2], "yyyyMMddHHmmss", new Date())
    : "2025-03-01T00:00:00Z";
  const end = process.argv[3]
    ? parse(process.argv[3], "yyyyMMddHHmmss", new Date())
    : Date.now();
  await genSnapshot(new Date(start).getTime(), new Date(end).getTime());
}
if (__filename === require.main.filename) {
  main()
    .catch((error) => {
      console.error("backend.balance.bucket: ", error);
    })
    .finally(() => client.disconnect());
}
