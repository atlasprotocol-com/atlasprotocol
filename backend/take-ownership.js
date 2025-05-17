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
  const selected = process.argv[2];
  await near.init();

  await updateGlobalParams(near);
  // Fetch and set chain configs before running the batch processes
  await fetchAndSetChainConfigs(near);
  await fetchAndSetConstants(near); // Load constants

  const { NETWORK_TYPE } = getConstants(); // Access constants dynamically

  const chainConfigs = getAllChainConfig();

  for (let chainid in chainConfigs) {
    const chainConfig = convert(chainConfigs[chainid]);
    const network = chainConfig.network_type;
    console.log(`[${chainid} - ${network}] ...`);

    if (network !== NETWORK_TYPE.EVM) {
      console.log(`[${chainid}] NETWORK NOT MATCHED ${selected}`);

      continue;
    }

    if (chainid !== selected) {
      console.log(`[${chainid}] CHAIN NOT MATCHED ${selected}`);
      continue;
    }

    const ethereum = new Ethereum(
      chainConfig.chain_id,
      chainConfig.chain_rpc_url,
      chainConfig.gas_limit,
      chainConfig.abtc_address,
      chainConfig.abi_path,
    );

    const derivationPath = chainConfig.network_type;

    const sender = await ethereum.deriveEthAddress(
      await near.nearMPCContract.public_key(),
      near.contract_id,
      derivationPath,
    );
    const signedTransaction = await ethereum.createAcceptOwnershipTx(
      near,
      sender,
    );

    const hexcode = Array.from(signedTransaction)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    console.log("-----------1");
    console.log(hexcode);

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
}
