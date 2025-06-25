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

const log = (data) => {
  try {
    const { amount } = JSON.parse(data);
    return { amount: amount.toString() };
  } catch {
    const decoded = iface.decodeEventLog("MintDeposit", data);
    return {
      amount: decoded.amount.toString(),
    };
  }
};

// const chainIds = (conf) =>
//   Object.values(conf)
//     .filter((x) => ["near", "evm"].includes(x.networkType.toLowerCase()))
//     .map((x) => x.chainId);

const chainIds = (conf) => ["11155111", "NEAR_TESTNET", "11155420"];

const bucketFromRange = (start, end) => {
  const from = start ? bucket2date(start) : subHours(new Date(), 25);
  const to = end ? bucket2date(end) : subHours(new Date(), 1);
  console.log(start, end);

  const offset = from.getTimezoneOffset() * 60 * 1000;

  const buckets = [];
  for (let cur = from; cur <= to; cur = addHours(cur, 1)) {
    const xfrom = cur.getTime() - offset;
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
  return format(new Date(ts), "yyyyMMddHH0000");
};

module.exports = { log, chainIds, bucket2date, bucketFromRange, ts2bucket };
