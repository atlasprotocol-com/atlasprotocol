const axios = require("axios");

// Initialize Relayer API Client instance for BTC testnet4
const BITHIVE_TESTNET4_RELAYER_URL = "https://relayer-signet.bithive.fi";
const MEMPOOL_TESTNET4_BASE_URL = "https://mempool.space/signet";
const relayerClient = axios.create({
  baseURL: BITHIVE_TESTNET4_RELAYER_URL,
});

// Fetch fee rate
async function getFeeRate() {
  try {
    const response = await axios.get(`${MEMPOOL_TESTNET4_BASE_URL}/api/v1/fees/recommended`);
    const feeRates = response.data;
    if (feeRates.fastestFee) {
      return feeRates.fastestFee;
    }
  } catch (error) {
    console.warn("Error fetching fee rates by mempool:", error.message);
  }
  throw new Error("Cannot estimate bitcoin gas fee rate");
}

// Build unsigned deposit PSBT
async function buildUnsignedDepositPsbt(input) {
  const feeRate = await getFeeRate();
  const response = await relayerClient.get("/deposit.buildUnsignedPsbt", {
    params: {
      input: JSON.stringify({
        ...input,
      }),
    },
  });
  return response.data.result.data.psbt;
}

// Submit finalized deposit PSBT
async function submitFinalizedDepositPsbt(data) {
  await relayerClient.post("/deposit.submitFinalizedPsbt", data);
}

// Get statistics deposit
async function getStatisticsDeposit() {
  const response = await relayerClient.get("/statistics.getDepositSummary");
  return response.data.result.data.summary;
}

// Get deposits
async function getDeposits(input) {
  const response = await relayerClient.get("/user.getDeposits", {
    params: {
      input: JSON.stringify(input),
    },
  });
  const deposits = response.data.result.data.deposits;
  return deposits.sort(
    (a, b) => b.depositTxBroadcastTimestamp - a.depositTxBroadcastTimestamp,
  );
}

// Build unsigned unstake message
async function buildUnsignedUnstakeMessage(input) {
  const response = await relayerClient.get("/unstake.buildUnsignedMessage", {
    params: {
      input: JSON.stringify(input),
    },
  });
  return response.data.result.data.message;
}

// Submit signed unstake message
async function submitSignedUnstakeMessage(data) {
  await relayerClient.post("/unstake.submitSignature", data);
}

// Build unsigned withdrawal PSBT
async function buildUnsignedWithdrawalPsbt(input) {
  const feeRate = await getFeeRate();
  const response = await relayerClient.get("/withdraw.buildUnsignedPsbt", {
    params: {
      input: JSON.stringify({
        ...input,
        feeRate: feeRate + 1, // + 1 to avoid bad fee estimation
      }),
    },
  });
  return response.data.result.data.psbt;
}

// Request Chain Signature for PSBT
async function withdrawChainSignPsbtAsync({ psbt, reinvestMessageVouts }) {
  const response = await relayerClient.post("/withdraw.chainSignPsbtAsync", {
    psbt,
    reinvestMessageVouts,
  }, {
    timeout: 10 * 60 * 1000,
  });
  return response.data.result.data.id;
}

// Get withdrawal Chain Signature PSBT
async function getWithdrawalChainSignPsbt({ id, finalized }) {
  const response = await relayerClient.get("/withdraw.getChainSignedPsbt", {
    params: {
      input: JSON.stringify({
        id,
        finalized,
      }),
    },
  });
  return response.data.result.data;
}

// Submit withdrawal finalized PSBT
async function submitWithdrawalFinalizedPsbt({ psbt, broadcast }) {
  const response = await relayerClient.post("/withdraw.submitFinalizedPsbt", {
    psbt,
    broadcast,
  });
  return response.data.result.data.txHash;
}

// Get account details
async function getAccount(input) {
  const response = await relayerClient.get("/user.getAccount", {
    params: {
      input: JSON.stringify(input),
    },
  });
  return response.data.result.data.account;
}

// Convert base64 string to hex
async function base64ToHex(base64) {
  const raw = atob(base64);
  let hex = "";
  for (let i = 0; i < raw.length; i++) {
    const hexByte = raw.charCodeAt(i).toString(16);
    hex += (hexByte.length === 1 ? "0" : "") + hexByte;
  }
  return hex;
}

module.exports = {
  getFeeRate,
  buildUnsignedDepositPsbt,
  submitFinalizedDepositPsbt,
  getStatisticsDeposit,
  getDeposits,
  buildUnsignedUnstakeMessage,
  submitSignedUnstakeMessage,
  buildUnsignedWithdrawalPsbt,
  withdrawChainSignPsbtAsync,
  getWithdrawalChainSignPsbt,
  submitWithdrawalFinalizedPsbt,
  getAccount,
  base64ToHex,
};
