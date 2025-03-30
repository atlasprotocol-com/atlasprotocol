const fs = require("fs");
const dotenv = require("dotenv");
const btc = require("bitcoinjs-lib");
const e = require("cors");

const { Bitcoin } = require("./services/bitcoin");
const { Ethereum } = require("./services/ethereum");
const { Near } = require("./services/near");
const {
  fetchAndSetChainConfigs,
  getChainConfig,
  convert,
} = require("./utils/network.chain.config");
const { fetchAndSetConstants, getConstants } = require("./constants");
const { updateGlobalParams } = require("./config/globalParams");

const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envFile });

const GAS_FOR_MINT_CALL = 100; // Gas for minting call

// Configuration for NEAR connection
const nearConfig = {
  networkId: process.env.NEAR_NETWORK_ID,
  nodeUrl: process.env.NEAR_NODE_URL,
  walletUrl: process.env.NEAR_WALLET_URL,
  helperUrl: process.env.NEAR_HELPER_URL,
  explorerUrl: process.env.NEAR_EXPLORER_URL,
  contractId: process.env.NEAR_CONTRACT_ID,
  mpcContractId: process.env.NEAR_MPC_CONTRACT_ID,
  accountId: process.env.NEAR_ACCOUNT_ID,
  pk: process.env.NEAR_PRIVATE_KEY,
  gas: process.env.NEAR_DEFAULT_GAS,
};

const near = new Near(
  nearConfig.nodeUrl,
  nearConfig.accountId,
  nearConfig.contractId,
  nearConfig.pk,
  nearConfig.networkId,
  nearConfig.gas,
  nearConfig.mpcContractId,
);

const btcConfig = {
  btcAtlasDepositAddress: process.env.BTC_ATLAS_DEPOSIT_ADDRESS,
  btcAPI: process.env.BTC_MEMPOOL_API_URL,
  btcNetwork: process.env.BTC_NETWORK,
  btcDerivationPath: process.env.BTC_DERIVATION_PATH,
};

const bitcoin = new Bitcoin(btcConfig.btcAPI, btcConfig.btcNetwork);

main().then(() => setTimeout(process.exit.bind(process, 0), 1000));

async function main() {
  const txnhash = process.argv[2];
  if (!txnhash) {
    console.error("txnhash is required");
    process.exit(1);
  }

  await near.init();

  await updateGlobalParams(near);
  // Fetch and set chain configs before running the batch processes
  await fetchAndSetChainConfigs(near);
  await fetchAndSetConstants(near); // Load constants

  const tx = await near.getRedemptionByTxnHash(txnhash);

  const { address, publicKey } = await bitcoin.deriveBTCAddress(near);
  console.log("------0");

  const payload = await bitcoin.createPayload(near, address, tx.txn_hash);

  // Create the PSBT from the base64 payload and add UTXOs
  const psbt = btc.Psbt.fromBase64(payload.psbt);
  await bitcoin.addUtxosToPsbt(psbt, payload.utxos);

  console.log("------1");
  // Update the payload with the new PSBT
  const updatedPayload = {
    ...payload,
    psbt: psbt,
  };

  console.log("------2");
  const signedTransaction = await bitcoin.requestSignatureToMPC(
    near,
    updatedPayload,
    publicKey,
    tx.txn_hash,
  );

  const hexcode = Array.from(signedTransaction)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  console.log("-----------1");
  console.log(hexcode);
  console.log("-----------2");
  console.log(signedTransaction);
}
