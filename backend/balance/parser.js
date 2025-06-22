const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");

const abi = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../contract/artifacts/atBTC.abi"),
    "utf8",
  ),
);
const iface = new ethers.Interface(abi);

const log = (data) => {
  const decoded = iface.decodeEventLog("MintDeposit", data);
  return {
    btcTxnHash: decoded.btcTxnHash,
    amount: decoded.amount.toString(),
  };
};

const chains = (conf) =>
  Object.values(conf).filter((x) =>
    ["near", "evm"].includes(x.networkType.toLowerCase()),
  );

const bucket2date = (bucket) => {
  const year = bucket.slice(0, 4);
  const month = bucket.slice(4, 6);
  const day = bucket.slice(6, 8);
  const hour = bucket.slice(8, 10);
  return new Date(Date.UTC(year, month - 1, day, hour));
};

module.exports = { log, chains, bucket2date };
