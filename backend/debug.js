const { ethers } = require("ethers");

// Event ABI
const abi = [
  "event MintDeposit(address indexed wallet, string btcTxnHash, uint256 amount)",
];

// Create interface
const iface = new ethers.Interface(abi);

// Your raw `data` from Goldsky DB
const rawData =
  "0x000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000070ce000000000000000000000000000000000000000000000000000000000000004066346138613036643936626432613639316266626339336233333633623936643565366233346466626338643234623566613731356433356265326633373037";

// Decode the data (no topics, just the data column)
const decoded = iface.decodeEventLog("MintDeposit", rawData);

console.log("Wallet:", decoded.wallet);
console.log("String:", decoded.btcTxnHash);
console.log("Amount:", decoded.amount.toString());
