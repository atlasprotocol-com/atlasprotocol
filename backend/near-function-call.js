const fs = require("fs");
const dotenv = require("dotenv");
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
  nodeUrlProvider: process.env.NEAR_NODE_URL_PROVIDER,
  walletUrl: process.env.NEAR_WALLET_URL,
  helperUrl: process.env.NEAR_HELPER_URL,
  explorerUrl: process.env.NEAR_EXPLORER_URL,
  contractId: process.env.NEAR_CONTRACT_ID,
  mpcContractId: process.env.NEAR_MPC_CONTRACT_ID,
  accountId: process.env.NEAR_ACCOUNT_ID,
  pk: process.env.NEAR_PRIVATE_KEY,
  gas: process.env.NEAR_DEFAULT_GAS,
  bitHiveContractId: process.env.NEAR_BIT_HIVE_CONTRACT_ID,
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
  nearConfig.bitHiveContractId,
);

main().then(() => setTimeout(process.exit.bind(process, 0), 1000));

async function main() {
  await near.init();

  await updateGlobalParams(near);
  await fetchAndSetChainConfigs(near);
  await fetchAndSetConstants(near); // Load constants

  const args = {
    btc_txn_hash:
      "a226e0a2a39ddf59554eb9457fbf1a3442273139b4fb4741f51c6cd578d5b0ce",
    nonce: 0,
    gas: 100,
    max_fee_per_gas: 0,
    max_priority_fee_per_gas: 0,
  };
  const data = await near.createMintaBtcSignedTx(args);
  console.log(data);
}
