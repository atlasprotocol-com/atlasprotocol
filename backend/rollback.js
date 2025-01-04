if (!Array.prototype.all) {
  Array.prototype.all = function (predicate) {
    if (typeof predicate !== "function") {
      throw new TypeError("Predicate must be a function");
    }
    for (let i = 0; i < this.length; i++) {
      if (!predicate(this[i], i, this)) {
        return false;
      }
    }
    return true;
  };
}

const dotenv = require("dotenv");
const { Near } = require("./services/near");
const { Bitcoin } = require("./services/bitcoin");
const { Ethereum } = require("./services/ethereum");

const {
  fetchAndSetChainConfigs,
  getAllChainConfig,
  convert,
} = require("./utils/network.chain.config");
const { fetchAndSetConstants, getConstants } = require("./constants");
const { updateGlobalParams, globalParams } = require("./config/globalParams");
const { UpdateAtlasBtcDeposits } = require("./utils/updateAtlasBtcDeposits");
const { WithdrawFailDepoists } = require("./utils/withdrawFailDepoists");

const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envFile });

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

// Configuration for BTC connection
const btcConfig = {
  //btcAtlasDepositAddress: process.env.BTC_ATLAS_DEPOSIT_ADDRESS,
  btcAtlasDepositAddress:
    process.env.USE_COBO === "true"
      ? process.env.COBO_DEPOSIT_ADDRESS
      : process.env.BTC_ATLAS_DEPOSIT_ADDRESS,
  btcAPI: process.env.BTC_MEMPOOL_API_URL,
  btcNetwork: process.env.BTC_NETWORK,
  btcDerivationPath: process.env.BTC_DERIVATION_PATH,
};

const bitcoin = new Bitcoin(btcConfig.btcAPI, btcConfig.btcNetwork);

const btcAtlasDepositAddress = btcConfig.btcAtlasDepositAddress;

main().then(() => setTimeout(process.exit.bind(process, 0), 1000));

async function main() {
  await near.init();

  await updateGlobalParams(near);
  // Fetch and set chain configs before running the batch processes
  await fetchAndSetChainConfigs(near);
  await fetchAndSetConstants(near); // Load constants

  const btcMempool = await bitcoin.fetchTxnsByAddress(btcAtlasDepositAddress);
  await UpdateAtlasBtcDeposits(
    btcMempool,
    btcAtlasDepositAddress,
    near,
    bitcoin,
  );

  for (let i = 0; i <= globalParams.maxRetryCount; i++) {
    // await fake().catch(console.error);
  }

  const deposits = await near.getAllDeposits();
  await WithdrawFailDepoists(deposits, near, bitcoin);
}

async function fake() {
  const [btcTxnHash, chainConfig] =
    await near.getFirstValidDepositChainConfig();

  console.log(`> BTC Transaction Hash: ${btcTxnHash}`);
  const ethereum = new Ethereum(
    chainConfig.chain_id,
    chainConfig.chain_rpc_url,
    chainConfig.gas_limit,
    chainConfig.abtc_address,
    chainConfig.abi_path,
  );

  let derivationPath = chainConfig.network_type;

  // Generate the derived address for the aBTC minter & sender
  const sender = await ethereum.deriveEthAddress(
    await near.nearMPCContract.public_key(),
    near.contract_id,
    derivationPath,
  );

  console.log(`Minter and sender address: ${sender}`);
  await ethereum.createMintaBtcSignedTx(near, sender, btcTxnHash);
  await near.updateDepositRemarks(btcTxnHash, "oops, something went wrong");

  await near.rollbackDepositStatusByBtcTxnHash({ btc_txn_hash: btcTxnHash });
}
