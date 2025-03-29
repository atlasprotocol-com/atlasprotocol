const fs = require("fs");
const dotenv = require("dotenv");

const { fetchAndSetConstants, getConstants } = require("./constants");
const { Bitcoin } = require("./services/bitcoin");
const { Ethereum } = require("./services/ethereum");
const { Near } = require("./services/near");

const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envFile });

const btcConfig = {
  btcAtlasDepositAddress: process.env.BTC_ATLAS_DEPOSIT_ADDRESS,
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
  const exist = await fs.promises
    .stat(filename)
    .then(() => true)
    .catch(() => false);
  if (!exist) throw new Error(`${filename} is not exist`);

  const raw = await fs.promises.readFile(filename, "utf8");
  const { chains } = JSON.parse(raw);

  await near.init();
  await fetchAndSetConstants(near); // Load constants

  const { address: btcAddress } = await bitcoin.deriveBTCAddress(near);
  console.log(`BITCOIN -> ${btcAddress}`);

  console.log(`NEAR -> ${await near.getCurrentBlockNumber()}`);
  for (let chain of chains) {
    if (chain.network_type !== "EVM") continue;

    const ethereum = new Ethereum(
      chain.chain_id,
      chain.chain_rpc_url,
      chain.gas_limit,
      chain.abtc_address,
      chain.abi_path,
    );
    const derivationPath = chain.network_type;
    const sender = await ethereum.deriveEthAddress(
      await near.nearMPCContract.public_key(),
      near.contract_id,
      derivationPath,
    );

    const block = await ethereum.getCurrentBlockNumber();
    console.log(`${chain.chain_id} -> ${sender} | ${block}`);
  }
}
