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
  const from = start ? new Date(Number(start)) : subHours(new Date(), 2);
  const to = end ? new Date(Number(end)) : subHours(new Date(), 1);

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
  return new Date(Date.UTC(year, month - 1, day, hour));
};

module.exports = { log, chainIds, bucket2date, bucketFromRange };
