/* eslint-disable import/order */

const dotenv = require("dotenv");
const { globalParams, updateGlobalParams } = require("./config/globalParams");
const { getTransactionsAndComputeStats } = require("./utils/transactionStats");
const { UpdateAtlasBtcDeposits } = require("./utils/updateAtlasBtcDeposits");
const { WithdrawFailDeposits } = require("./utils/WithdrawFailDeposits");
const {
  UpdateWithdrawFailDeposits,
} = require("./utils/UpdateWithdrawFailDeposits");
const {
  MintaBtcToReceivingChain,
} = require("./utils/mintaBtcToReceivingChain");
const {
  UpdateAtlasBtcRedemptions,
} = require("./utils/updateAtlasBtcRedemptions");
const { SendBtcBackToUser } = require("./utils/sendBtcBackToUser");
const {
  UpdateAtlasBtcBackToUser,
} = require("./utils/updateAtlasBtcBackToUser");
const { UpdateAtlasAbtcMinted } = require("./utils/updateAtlasAbtcMinted");
const { UpdateAtlasAbtcMintedTxnHash } = require("./utils/UpdateAtlasAbtcMintedTxnHash");

const {
  fetchAndSetChainConfigs,
  getAllChainConfig,
} = require("./utils/network.chain.config");
const { fetchAndSetConstants, getConstants } = require("./constants");

// Load environment variables from .env.local or .env based on NODE_ENV
const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envFile });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
app.use(cors());
app.use(helmet());

const { Bitcoin } = require("./services/bitcoin");
const { Near } = require("./services/near");

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

app.use(cors());
app.use(helmet());

const btcAtlasDepositAddress = btcConfig.btcAtlasDepositAddress;
let atlasStats = {};
let deposits = [];
let redemptions = [];
let btcMempool = [];

const computeStats = () => {
  atlasStats = getTransactionsAndComputeStats(
    deposits,
    redemptions,
    btcAtlasDepositAddress,
  );
  //console.log("Computed Atlas Stats:", atlasStats);
};

// Function to poll Near Atlas deposit records
const getAllDepositHistory = async () => {
  try {
    //console.log("Fetching deposits history");
    deposits = await near.getAllDeposits();
  } catch (error) {
    console.error(`Failed to fetch staking history: ${error.message}`);
  }
};

// Function to poll Near Atlas redemption records
const getAllRedemptionHistory = async () => {
  try {
    //console.log("Fetching redemptions history");
    redemptions = await near.getAllRedemptions();
  } catch (error) {
    console.error(`Failed to fetch redemption history: ${error.message}`);
  }
};

// Function to poll Btc mempool records
const getBtcMempoolRecords = async () => {
  try {
    //console.log("Fetching Btc Mempool Records");
    btcMempool = await bitcoin.fetchTxnsByAddress(btcAtlasDepositAddress);
  } catch (error) {
    console.error(`Failed to fetch Btc Mempool records: ${error.message}`);
  }
};

app.get("/api/v1/atlas/address", async (req, res) => {
  try {
    res.json({ btcAtlasDepositAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
});

app.get("/api/v1/stats", async (req, res) => {
  try {
    const data = {
      active_tvl: atlasStats.activeTVLSat,
      total_tvl: atlasStats.totalTVLSat,
      total_stakers: atlasStats.totalStakers,
      unconfirmed_tvl: atlasStats.unconfirmedTVLSat,
    };
    res.json({ data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
});

app.get("/api/v1/atlas/redemptionFees", async (req, res) => {
  try {
    const { sender, amount, redemptionTxnHash } = req.query;

    const { estimatedFee, receiveAmount, taxAmount } =
      await bitcoin.getMockPayload(
        btcConfig.btcAtlasDepositAddress,
        sender,
        amount,
        redemptionTxnHash,
        globalParams.atlasRedemptionFeePercentage,
        globalParams.atlasTreasuryAddress,
      );

    const data = {
      estimatedGasFee: estimatedFee,
      estimatedReceiveAmount: receiveAmount,
      atlasRedemptionFee: taxAmount,
    };

    //console.log(data);

    res.json({ data });
  } catch (error) {
    console.log("Error getting gas fee: " + error);
    res.status(500).json({ error: "Error getting gas fee. " + error });
  }
});

app.get("/api/v1/global-params", async (req, res) => {
  try {
    // Dummy data to be replaced with actual data fetching logic
    const data = {
      versions: [
        {
          staking_cap: globalParams.stakingCap,
          max_staking_amount: globalParams.maxStakingAmount,
          min_staking_amount: globalParams.minStakingAmount,
          atlas_address: btcAtlasDepositAddress,
          deposit_fee_percentage: globalParams.atlasDepositFeePercentage,
          treasury_address: globalParams.atlasTreasuryAddress,
        },
      ],
    };

    res.json({ data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
});

app.get("/api/v1/staker/stakingHistories", async (req, res) => {
  try {
    const { btc_address } = req.query;

    if (!btc_address) {
      return res.status(400).json({ error: "ERR_MISSING_WALLET_ADDRESS" });
    }

    const filteredData = deposits
      .filter((record) => record.btc_sender_address === btc_address)
      .map((record) => ({
        btc_txn_hash: record.btc_txn_hash,
        btc_sender_address: record.btc_sender_address,
        receiving_chain_id: record.receiving_chain_id,
        receiving_address: record.receiving_address,
        btc_amount: record.btc_amount,
        minted_txn_hash: record.minted_txn_hash,
        timestamp: record.timestamp,
        status: record.status,
        remarks: record.remarks,
      }));

    const pagination = {
      next_key: null, // Assuming there is no pagination support for this example
    };

    res.json({ data: filteredData, pagination });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
});

app.get("/api/v1/staker/redemptionHistories", async (req, res) => {
  try {
    const { btc_address } = req.query;

    if (!btc_address) {
      return res.status(400).json({ error: "ERR_MISSING_WALLET_ADDRESS" });
    }

    const data = redemptions
      .filter((record) => record.btc_receiving_address === btc_address)
      .map((record) => ({
        txn_hash: record.txn_hash,
        abtc_redemption_address: record.abtc_redemption_address,
        abtc_redemption_chain_id: record.abtc_redemption_chain_id,
        btc_receiving_address: record.btc_receiving_address,
        abtc_amount: record.abtc_amount,
        timestamp: record.timestamp,
        status: record.status,
        remarks: record.remarks,
        btc_txn_hash: record.btc_txn_hash,
      }));

    const pagination = {
      next_key: null, // Assuming there is no pagination support for this example
    };

    res.json({ data, pagination });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
});

// Define the /api/v1/chainConfigs endpoint
app.get("/api/v1/chainConfigs", (req, res) => {
  try {
    // Normally, fetch data from a database, but here we're using mock data
    res.status(200).json({ data: getAllChainConfig() });
  } catch (error) {
    console.error("Error fetching chain configs:", error);
    res.status(500).json({ message: "Error fetching chain configs" });
  }
});

async function runBatch() {
  await getAllDepositHistory();
  await getAllRedemptionHistory();
  await getBtcMempoolRecords();
  await computeStats();

  await UpdateAtlasBtcDeposits(
    btcMempool,
    btcAtlasDepositAddress,
    globalParams.atlasTreasuryAddress,
    globalParams.atlasDepositFeePercentage,
    near,
    bitcoin,
  );

  await MintaBtcToReceivingChain(near);

  await UpdateAtlasAbtcMintedTxnHash(deposits, near);

  await UpdateAtlasAbtcMinted(deposits, near);

  await WithdrawFailDeposits(deposits, near, bitcoin);
  await UpdateWithdrawFailDeposits(deposits, near, bitcoin);

  await UpdateAtlasBtcRedemptions(near);

  await SendBtcBackToUser(redemptions, near, bitcoin);

  await UpdateAtlasBtcBackToUser(
    redemptions,
    btcMempool,
    btcAtlasDepositAddress,
    near,
    bitcoin,
  );

  // Delay for 5 seconds before running the batch again
  await new Promise((resolve) => setTimeout(resolve, 5000));
  return runBatch();
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  await near.init();
  await updateGlobalParams(near);
  // Fetch and set chain configs before running the batch processes
  await fetchAndSetChainConfigs(near);
  await fetchAndSetConstants(near); // Load constants
  console.log(`Server is running on port ${PORT}`);
  // const derivationPath = "BITCOIN";
  //   const { address, publicKey } = await bitcoin.deriveBTCAddress(
  //     await near.nearMPCContract.public_key(),
  //     near.contract_id,
  //     derivationPath,
  //   );
  // console.log("Bitcoin address: " + address);
  runBatch().catch(console.error);
});
