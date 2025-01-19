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

main().then(() => setTimeout(process.exit.bind(process, 0), 1000));

async function main() {
  const txs = process.argv.slice(2);
  if (txs.length === 0) {
    console.error("btc tx is required");
    process.exit(1);
  }

  await near.init();

  await updateGlobalParams(near);
  // Fetch and set chain configs before running the batch processes
  await fetchAndSetChainConfigs(near);
  await fetchAndSetConstants(near); // Load constants

  const { NETWORK_TYPE } = getConstants(); // Access constants dynamically

  const records = await Promise.all(
    txs.map((tx) => near.getDepositByBtcTxnHash(tx)),
  );

  await Promise.all(
    records.map(async (tx) => {
      const btcTxnHash = tx.btc_txn_hash;
      console.log("-----------" + btcTxnHash);

      const chainConfig = convert(getChainConfig(tx.receiving_chain_id));

      if (chainConfig.network_type === NETWORK_TYPE.EVM) {
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

        const signedTransaction = await ethereum.createMintaBtcSignedTx(
          near,
          sender,
          btcTxnHash,
        );

        const hexcode = Array.from(signedTransaction)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");

        console.log(hexcode);
      }

      if (chainConfig.network_type === NETWORK_TYPE.NEAR) {
        const payloadHeader = {
          btc_txn_hash: btcTxnHash,
          nonce: 0,
          gas: GAS_FOR_MINT_CALL,
          max_fee_per_gas: 0,
          max_priority_fee_per_gas: 0,
        };

        // Create payload to deploy the contract
        const signedTransaction =
          await near.createMintaBtcSignedTx(payloadHeader);
        const hexcode = Array.from(signedTransaction)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");

        console.log(hexcode);
      }
    }),
  );
}
