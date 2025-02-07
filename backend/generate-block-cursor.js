const fs = require("fs");
const dotenv = require("dotenv");

const { fetchAndSetConstants, getConstants } = require("./constants");
const { Bitcoin } = require("./services/bitcoin");
const { Ethereum } = require("./services/ethereum");
const { Near } = require("./services/near");
const { setBlockCursor } = require("./utils/batchTime/lastScannedBlockHelper");

const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envFile });

const btcConfig = {
  btcAtlasDepositAddress:
    process.env.USE_COBO === "true"
      ? process.env.COBO_DEPOSIT_ADDRESS
      : process.env.BTC_ATLAS_DEPOSIT_ADDRESS,
  btcAPI: process.env.BTC_MEMPOOL_API_URL,
  btcNetwork: process.env.BTC_NETWORK,
  btcDerivationPath: process.env.BTC_DERIVATION_PATH,
};

const bitcoin = new Bitcoin(btcConfig.btcAPI, btcConfig.btcNetwork);

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
  const filename = process.argv[2];
  if (!filename) throw new Error("Config file is not set");

  const workflow = process.argv[3];
  if (!workflow) throw new Error("Workflow file is not set");

  const backfill = Number(
    process.argv[4] || process.env.BLOCK_CURSOR_BACKFILL || 100,
  );

  const exist = await fs.promises
    .stat(filename)
    .then(() => true)
    .catch(() => false);
  if (!exist) throw new Error(`${filename} is not exist`);

  const raw = await fs.promises.readFile(filename, "utf8");
  const { chains } = JSON.parse(raw);

  await near.init();
  await fetchAndSetConstants(near); // Load constants

  const { NETWORK_TYPE } = getConstants();

  for (let chain of chains) {
    if (chain.network_type === NETWORK_TYPE.EVM) {
      const ethereum = new Ethereum(
        chain.chain_id,
        chain.chain_rpc_url,
        chain.gas_limit,
        chain.abtc_address,
        chain.abi_path,
      );

      const block = await ethereum.getCurrentBlockNumber();
      await setBlockCursor(workflow, chain.chain_id, Number(block) - backfill);
    }

    if (chain.network_type === NETWORK_TYPE.NEAR) {
      const block = await near.getCurrentBlockNumber();
      await setBlockCursor(workflow, chain.chain_id, Number(block) - backfill);
    }
  }
}
