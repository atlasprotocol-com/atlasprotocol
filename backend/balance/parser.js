const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");
const { format, subHours, addHours } = require("date-fns");

const abi = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../contract/artifacts/atBTC.abi"),
    "utf8",
  ),
);
const iface = new ethers.Interface(abi);

const MULTIPLIER_MAP = {
  "0x5448dd0f4c23b4bed107869be9c14ffd7f38c6c3ded0eced40ef6ff7b8f3fc05": 1,
  "0xb8bdadb84da719b84d72f39a7dabc240534c4575a5ed3fe75269c19caa11aaed": -1,
  "0x0e41a555d3c09325f1748b91e03e382e89153d916d4d6789a41524e2746fd91d": 1,
  "0x32dd79c076d214468c853220a3c326a3ba8b2d26491388e9f124955f05dee517": -1,
  mint_deposit: 1,
  burn_redemption: -1,
  mint_bridge: 1,
  burn_bridge: -1,
};

const multiply = (topics) => {
  const parts = topics
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (MULTIPLIER_MAP[part]) {
      return MULTIPLIER_MAP[part];
    }
  }

  return 0;
};

const log = (topics, data) => {
  if (
    topics.includes(
      "0x5448dd0f4c23b4bed107869be9c14ffd7f38c6c3ded0eced40ef6ff7b8f3fc05",
    )
  ) {
    const decoded = iface.parseLog({ topics: topics.split(","), data });
    return {
      wallet_address: decoded.args[0].toLowerCase(),
      amount: decoded.args[2].toString(),
    };
  }

  if (
    topics.includes(
      "0xb8bdadb84da719b84d72f39a7dabc240534c4575a5ed3fe75269c19caa11aaed",
    )
  ) {
    const decoded = iface.parseLog({ topics: topics.split(","), data });
    return {
      wallet_address: decoded.args[0].toLowerCase(),
      amount: decoded.args[2].toString(),
    };
  }

  if (
    topics.includes(
      "0x0e41a555d3c09325f1748b91e03e382e89153d916d4d6789a41524e2746fd91d",
    )
  ) {
    const decoded = iface.parseLog({ topics: topics.split(","), data });
    return {
      wallet_address: decoded.args[0].toLowerCase(),
      amount: decoded.args[3].toString(),
    };
  }

  if (
    topics.includes(
      "0x32dd79c076d214468c853220a3c326a3ba8b2d26491388e9f124955f05dee517",
    )
  ) {
    const decoded = iface.parseLog({ topics: topics.split(","), data });
    return {
      wallet_address: decoded.args[0].toLowerCase(),
      amount: decoded.args[3].toString(),
    };
  }

  if (
    topics.includes("mint_deposit") ||
    topics.includes("burn_redemption") ||
    topics.includes("mint_bridge") ||
    topics.includes("burn_bridge")
  ) {
    const { amount, wallet, address } = JSON.parse(data);
    return {
      amount: amount.toString(),
      wallet_address: (wallet || address).toLowerCase(),
    };
  }
};

const chainIds = (conf) =>
  Object.values(conf)
    .filter((x) => ["near", "evm"].includes(x.networkType.toLowerCase()))
    .map((x) => x.chainID)
    .filter(Boolean);

const bucketFromRange = (start, end) => {
  const from = start ? bucket2date(start) : subHours(new Date(), 25);
  const to = end ? bucket2date(end) : subHours(new Date(), 1);

  const offset = from.getTimezoneOffset() * 60 * 1000;

  const buckets = [];
  for (let cur = from; cur <= to; cur = addHours(cur, 1)) {
    const xfrom = cur.getTime() + offset;
    const xto = xfrom + 3600000; // 1 hour in milliseconds
    const xbucket = format(xfrom, "yyyyMMddHH0000");
    buckets.push({ bucket: xbucket, from_ts: xfrom, to_ts: xto });
  }
  return { buckets, from, to };
};

const bucket2date = (bucket) => {
  const year = bucket.slice(0, 4);
  const month = bucket.slice(4, 6);
  const day = bucket.slice(6, 8);
  const hour = bucket.slice(8, 10);
  const minute = bucket.slice(10, 12);
  const second = bucket.slice(12, 14);
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
};

const ts2bucket = (ts) => {
  if (ts.toString().length === 10) ts = Number(ts) * 1000;
  const time = new Date(ts);
  const offset = time.getTimezoneOffset() * 60 * 1000;

  return format(new Date(time.getTime() + offset), "yyyyMMddHH0000");
};

module.exports = {
  log,
  chainIds,
  bucket2date,
  bucketFromRange,
  ts2bucket,
  multiply,
};
