const fs = require("fs");
const dotenv = require("dotenv");
const { Ethereum } = require("./services/ethereum");
const { Near } = require("./services/near");

const {
  fetchAndSetChainConfigs,
  getAllChainConfig,
  convert,
} = require("./utils/network.chain.config");
const { fetchAndSetConstants, getConstants } = require("./constants");
const { updateGlobalParams } = require("./config/globalParams");

const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envFile });

// Configuration for NEAR connection
const nearConfig = {
  networkId: process.env.NEAR_NETWORK_ID,
  nodeUrl: process.env.NEAR_NODE_URL,
  nodeUrlProvider: process.env.NEAR_NODE_URL_PROVIDER,
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
  nearConfig.nodeUrlProvider,
  nearConfig.accountId,
  nearConfig.contractId,
  nearConfig.pk,
  nearConfig.networkId,
  nearConfig.gas,
  nearConfig.mpcContractId,
);

main().then(() => setTimeout(process.exit.bind(process, 0), 1000));

async function main() {
  const CHAIN_ID = process.argv[2];
  if (!CHAIN_ID) {
    console.log("Please provide chain id");
    return;
  }

  const TXN_HASH = process.argv[3];
  if (!TXN_HASH) {
    console.log("Please provide transaction hash");
    return;
  }

  await near.init();

  await updateGlobalParams(near);
  // Fetch and set chain configs before running the batch processes
  await fetchAndSetChainConfigs(near);
  await fetchAndSetConstants(near); // Load constants

  const chainConfigs = getAllChainConfig();
  if (!chainConfigs[CHAIN_ID]) {
    console.log(`[${CHAIN_ID}] chain not found`);
    return;
  }

  const chainConfig = convert(chainConfigs[CHAIN_ID]);
  const ethereum = new Ethereum(
    chainConfig.chain_id,
    chainConfig.chain_rpc_url,
    chainConfig.gas_limit,
    chainConfig.abtc_address,
    chainConfig.abi_path,
  );

  const tx = await near.provider.txStatus(TXN_HASH, near.contract_id, "FINAL");
  if (!tx || !tx.status || !tx.status.SuccessValue) {
    const failure = JSON.stringify(tx && tx.status);
    console.log(
      `Tx Failure ###########################################: ${failure}`,
    );
    return;
  }

  const value = Buffer.from(tx.status.SuccessValue, "base64").toString("utf-8");

  const signedTransaction = new Uint8Array(JSON.parse(value));
  const { txnHash, status } = await ethereum.relayTransaction(
    null,
    null,
    signedTransaction,
  );

  console.log("-----------2");
  console.log(txnHash);

  console.log("-----------3");
  console.log(status);
}
