/* eslint-disable import/order */

const dotenv = require("dotenv");

// Load environment variables from .env.local or .env based on NODE_ENV
const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envFile });

const { globalParams, updateGlobalParams } = require("./config/globalParams");
const { getTransactionsAndComputeStats } = require("./utils/transactionStats");
const { flagsBatch } = require("./utils/batchFlags");
const {
  UpdateAtlasBtcDeposits,
  processNewDeposit,
} = require("./utils/updateAtlasBtcDeposits");
const { WithdrawFailDeposits } = require("./utils/withdrawFailDeposits");
const {
  UpdateWithdrawFailDeposits,
} = require("./utils/updateWithdrawFailDeposits");
const {
  MintaBtcToReceivingChain,
} = require("./utils/mintaBtcToReceivingChain");
const {
  MintBridgeABtcToDestChain,
} = require("./utils/mintBridgeABtcToDestChain");
const {
  checkAndUpdateMintedTxnHash,
} = require("./helpers/checkAndUpdateMintedTxnHash");

const {
  UpdateAtlasBtcBackToUser,
} = require("./utils/updateAtlasBtcBackToUser");
const {
  UpdateAtlasAbtcMintedTxnHash,
} = require("./utils/updateAtlasAbtcMintedTxnHash");
const { UpdateAtlasAbtcMinted } = require("./utils/updateAtlasAbtcMinted");
const {
  UpdateYieldProviderStaked,
} = require("./utils/updateYieldProviderStaked");
const {
  fetchAndSetChainConfigs,
  getAllChainConfig,
  getChainConfig,
} = require("./utils/network.chain.config");
const { fetchAndSetConstants, getConstants } = require("./constants");

// Ensure StakeToYieldProvider is imported or defined
const {
  StakeToYieldProvider,
  getBithiveDeposits,
} = require("./utils/stakeToYieldProvider");

const {
  UpdateAtlasBtcWithdrawnFromYieldProvider,
} = require("./utils/updateAtlasBtcWithdrawnFromYieldProvider");
const { SendBtcBackToUser } = require("./utils/sendBtcBackToUser");
const {
  estimateRedemptionFees,
  estimateBridgingFees,
} = require("./services/bithive");
const {
  UpdateAtlasBtcBridgingYieldProviderWithdrawn,
} = require("./utils/updateAtlasBtcBridgingYieldProviderWithdrawn");
const {
  SendBridgingFeesToTreasury,
} = require("./utils/sendBridgingFeesToTreasury");
const {
  RetrieveAndProcessPastNearEvents,
} = require("./utils/retrieveAndProcessPastNearEvents");
const { UpdateAtlasBtcDeposited } = require("./utils/updateAtlasBtcDeposited");

const {
  RetrieveAndProcessPastEvmEvents,
} = require("./utils/retrieveAndProcessPastEvmEvents");
const {
  UpdateAtlasBtcWithdrawingFromYieldProvider,
} = require("./utils/updateAtlasBtcWithdrawingFromYieldProvider");

const {
  UpdateAtlasRedemptionPendingBtcMempool,
} = require("./utils/updateAtlasRedemptionPendingBtcMempool");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
app.use(cors());
app.use(helmet());

const { Bitcoin } = require("./services/bitcoin");
const { Near } = require("./services/near");
const { Ethereum } = require("./services/ethereum");
const { getTxsOfNetwork } = require("./services/subquery");
const {
  processUnstakingAndWithdrawal,
} = require("./utils/processUnstakingAndWithdrawal");

const UpdateSendToUserBtcTxnHash = require('./helpers/updateSendToUserBtcTxnHash');

const {
  processBurnRedeemEvent,
} = require("./helpers/eventProcessor");

// Configuration for BTC connection
const btcConfig = {
  btcAtlasDepositAddress: process.env.BTC_ATLAS_DEPOSIT_ADDRESS,
  btcAPI: process.env.BTC_MEMPOOL_API_URL,
  btcNetwork: process.env.BTC_NETWORK,
  btcDerivationPath: process.env.BTC_DERIVATION_PATH,
  btcAtlasTreasuryAddress: process.env.BTC_ATLAS_TREASURY_ADDRESS,
  evmAtlasAddress: process.env.EVM_ATLAS_ADDRESS,
};

const bitcoin = new Bitcoin(btcConfig.btcAPI, btcConfig.btcNetwork);

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

app.use(cors());
app.use(helmet());

const btcAtlasDepositAddress = btcConfig.btcAtlasDepositAddress;
const evmAtlasAddress = btcConfig.evmAtlasAddress;
let atlasStats = {};
let deposits = [];
let redemptions = [];
let btcMempool = [];
let bridgings = [];
let bithiveRecords = [];
const computeStats = async () => {
  atlasStats = await getTransactionsAndComputeStats(
    deposits,
    redemptions,
    btcAtlasDepositAddress,
  );
  //console.log("Computed Atlas Stats:", atlasStats);
};

// Function to poll Near Atlas deposit records
const getAllDepositHistory = async (limit = 1000) => {
  if (flagsBatch.GetAllDepositHistoryRunning) {
    console.log(
      "[getAllDepositHistory] GetAllDepositHistoryRunning is running",
    );
    return;
  }

  flagsBatch.GetAllDepositHistoryRunning = true;

  try {
    //console.log("[getAllDepositHistory] Starting at", new Date().toISOString());

    // First, get the first batch to check if there are any deposits
    const firstBatch = await near.getAllDeposits(0, limit);

    if (firstBatch.length === 0) {
      deposits = [];
      console.log("[getAllDepositHistory] No deposits found");
      return;
    }

    let allDeposits = [...firstBatch];

    // Get total count from NEAR to calculate number of batches needed
    const totalCount = await near.getTotalDepositsCount();
    const totalBatches = Math.ceil(totalCount / limit);

    // Create an array of promises for parallel fetching
    const batchPromises = [];
    for (let i = 1; i < totalBatches; i++) {
      const currentOffset = i * limit;
      batchPromises.push(near.getAllDeposits(currentOffset, limit));
    }

    // Fetch all batches in parallel
    const batchResults = await Promise.all(batchPromises);

    // Combine all results
    batchResults.forEach((batch) => {
      allDeposits = allDeposits.concat(batch);
    });

    deposits = allDeposits;

    console.log(
      "[getAllDepositHistory] Total deposits fetched:",
      deposits.length,
    );
  } catch (error) {
    console.error(`[getAllDepositHistory] Failed: ${error.message}`);
  } finally {
    flagsBatch.GetAllDepositHistoryRunning = false;
  }
};

// Function to poll Near Atlas redemption records
const getAllRedemptionHistory = async (limit = 1000) => {
  if (flagsBatch.GetAllRedemptionHistoryRunning) {
    console.log("[getAllRedemptionHistory] GetAllRedemptionHistoryRunning is running");
    return;
  }

  flagsBatch.GetAllRedemptionHistoryRunning = true;

  try {
    // First, get the first batch to check if there are any redemptions
    const firstBatch = await near.getAllRedemptions(0, limit);

    if (firstBatch.length === 0) {
      redemptions = [];
      console.log("[getAllRedemptionHistory] No redemptions found");
      return;
    }

    let allRedemptions = [...firstBatch];

    // Get total count from NEAR to calculate number of batches needed
    const totalCount = await near.getTotalRedemptionsCount();
    // console.log("[getAllRedemptionHistory] Total redemptions count:", totalCount);
    // console.log("[getAllRedemptionHistory] Total redemptions limit:", limit);
    const totalBatches = Math.ceil(totalCount / limit);
    // console.log("[getAllRedemptionHistory] Total batches:", totalBatches);
    // Create an array of promises for parallel fetching
    const batchPromises = [];
    for (let i = 1; i < totalBatches; i++) {
      const currentOffset = i * limit;
      batchPromises.push(near.getAllRedemptions(currentOffset, limit));
    }

    // Fetch all batches in parallel
    const batchResults = await Promise.all(batchPromises);

    // Combine all results
    batchResults.forEach((batch) => {
      allRedemptions = allRedemptions.concat(batch);
    });

    redemptions = allRedemptions;

    // const { REDEMPTION_STATUS } = getConstants();
    // // Count redemptions with BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING status
    // const processingRedemptions = redemptions.filter(
    //   redemption => redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING
    // );
    // const processingCount = processingRedemptions.length;
    // const totalProcessingAmount = processingRedemptions.reduce(
    //   (sum, redemption) => sum + redemption.abtc_amount, 
    //   0
    // );

    // console.log(
    //   "[getAllRedemptionHistory] Redemptions with BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING status:",
    //   processingCount,
    //   "Total amount:", 
    //   totalProcessingAmount
    // );

    console.log(
      "[getAllRedemptionHistory] Total redemptions fetched:",
      redemptions.length,
    );
  } catch (error) {
    console.error(`[getAllRedemptionHistory] Failed: ${error.message}`);
  }
  finally {
    flagsBatch.GetAllRedemptionHistoryRunning = false;
  }
};

// Function to poll Near Atlas bridging records
const getAllBridgingHistory = async () => {
  try {
    //console.log("Fetching bridgings history");
    bridgings = await near.getAllBridgings();
  } catch (error) {
    console.error(`Failed to fetch bridging history: ${error.message}`);
  }
};

// Function to poll Btc mempool records
const getBtcMempoolRecords = async () => {
  try {
    //console.log("Fetching Btc Mempool Records");
    btcMempool = await bitcoin.fetchTxnsByAddress(btcAtlasDepositAddress);
    //btcMempool = await bitcoin.fetchUTXOs(btcAtlasDepositAddress);
  } catch (error) {
    console.error(`Failed to fetch Btc Mempool records: ${error.message}`);
  }
};

const getBithiveRecords = async () => {
  if (flagsBatch.GetBithiveRecordsRunning) {
    console.log("[getBithiveRecords] GetBithiveRecordsRunning is running");
    return;
  }

  flagsBatch.GetBithiveRecordsRunning = true;

  try {
    //console.log("[getBithiveRecords] Starting at", new Date().toISOString());
    const { publicKey } = await bitcoin.deriveBTCAddress(near);
    //console.log("[getBithiveRecords] Got public key, fetching deposits");
    bithiveRecords = await getBithiveDeposits(
      publicKey.toString("hex"),
      deposits.length,
    );
    //console.log("[getBithiveRecords] Completed at", new Date().toISOString());
  } catch (error) {
    console.error(`[getBithiveRecords] Failed: ${error.message}`);
  } finally {
    flagsBatch.GetBithiveRecordsRunning = false;
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
    // await getBtcMempoolRecords();
    // await getAllDepositHistory();
    // await getAllBridgingHistory();
    // await getAllRedemptionHistory();
    await computeStats();

    res.json({ data: { ...atlasStats } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
});

app.get("/api/v1/atlas/redemptionFees", async (req, res) => {
  try {
    const { amount } = req.query;

    const feeData = await estimateRedemptionFees(bitcoin, near, amount);

    const protocolFee = globalParams.atlasRedemptionFeePercentage * amount;

    const data = {
      estimatedRedemptionFee:
        feeData.estimated_redemption_fee < process.env.DUST_LIMIT
          ? process.env.DUST_LIMIT
          : feeData.estimated_redemption_fee,
      atlasProtocolFee:
        protocolFee < process.env.DUST_LIMIT
          ? process.env.DUST_LIMIT
          : protocolFee,
      estimatedRedemptionFeeRate: feeData.estimated_redemption_fee_rate,
    };

    res.json({ data });
  } catch (error) {
    console.log("Error getting gas fee: " + error);
    res.status(500).json({ error: "Error getting gas fee. " + error });
  }
});

app.get("/api/v1/atlas/bridgingFees", async (req, res) => {
  try {
    const { amount } = req.query;

    const feeData = await estimateBridgingFees(bitcoin, near, amount);

    console.log("feeData", feeData);

    const protocolFee = globalParams.atlasBridgingFeePercentage * amount;

    const data = {
      estimatedBridgingFee:
        feeData.estimated_bridging_fee < process.env.DUST_LIMIT
          ? process.env.DUST_LIMIT
          : feeData.estimated_bridging_fee,
      atlasProtocolFee:
        protocolFee === 0
          ? 0
          : protocolFee < process.env.DUST_LIMIT
            ? process.env.DUST_LIMIT
            : protocolFee,
      estimatedBridgingFeeRate: feeData.estimated_bridging_fee_rate,
    };

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
          evm_address: evmAtlasAddress,
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

    //await getBtcMempoolRecords();
    //await computeStats();
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
        yield_provider_gas_fee: record.yield_provider_gas_fee,
        minting_fee: record.minting_fee,
        protocol_fee: record.protocol_fee,
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

    await getAllRedemptionHistory();
    await computeStats();

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
        bridging_gas_fee_sat: record.bridging_gas_fee_sat,
        btc_redemption_fee: record.btc_redemption_fee,
        protocol_fee: record.protocol_fee,
        yield_provider_gas_fee: record.yield_provider_gas_fee,
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

app.get("/api/v1/staker/bridgeHistories", async (req, res) => {
  try {
    const { chain_address } = req.query;

    if (!chain_address) {
      return res.status(400).json({ error: "ERR_MISSING_CHAIN_ADDRESS" });
    }

    await getAllBridgingHistory();
    await computeStats();

    const data = bridgings.filter(
      (record) =>
        record.dest_chain_address === chain_address ||
        record.origin_chain_address === chain_address,
    );

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

app.get("/api/v1/bithive-deposit", async (req, res) => {
  try {
    res.status(200).json(bithiveRecords);
  } catch (error) {
    console.error("Error fetching bithive deposit:", error);
    res.status(500).json({ message: "Error fetching bithive deposit" });
  }
});

// API endpoint to get derived BTC address
app.get("/api/derived-address", async (req, res) => {
  try {
    const { NETWORK_TYPE } = getConstants();
    let derivationPath = NETWORK_TYPE.BITCOIN;

    if (!derivationPath) {
      throw new Error("NETWORK_TYPE.BITCOIN is undefined");
    }

    const { address: btcAddress, publicKey: btcPublicKey } =
      await bitcoin.deriveBTCAddress(near);

    const ethereum = new Ethereum(
      "421614", // Corrected property name
      "https://sepolia-rollup.arbitrum.io/rpc", // Corrected property name
      10000000, // Corrected property name
      "0xC3799bD41505fb8a0b335Ef7Ba52A8486f331b4F", // Corrected property name
      "../../contract/artifacts/atBTC.abi", // Corrected property name
    );

    derivationPath = "EVM"; // Corrected property name

    // Generate the derived address for the aBTC minter & sender
    const evmAddress = await ethereum.deriveEthAddress(
      await near.nearMPCContract.public_key(),
      near.contract_id,
      derivationPath,
    );

    res.json({
      evmAddress: evmAddress,
      btcAddress: btcAddress,
      btcPublicKey: btcPublicKey.toString("hex"),
      mpcContractId: near.mpcContractId,
      contractId: near.contract_id,
    });
  } catch (error) {
    console.error("Error deriving address:", error);
    res
      .status(500)
      .json({ error: "Failed to derive address", details: error.message });
  }
});

app.get("/subquery", async (req, res) => {
  const data = {
    // arbitrum: await getTxsOfNetwork("arbitrum"),
    // optimism: await getTxsOfNetwork("optimism"),
    near: await getTxsOfNetwork("near"),
  };
  res.json(data);
});

app.get("/api/v1/process-new-deposit", async (req, res) => {
  try {
    const { btcTxnHash } = req.query;

    if (!btcTxnHash) {
      return res
        .status(400)
        .json({ error: "BTC transaction hash is required" });
    }

    // Fetch transaction from mempool
    const txn = await bitcoin.fetchTxnByTxnID(btcTxnHash);

    if (!txn) {
      return res
        .status(404)
        .json({ error: "Transaction not found in mempool" });
    }

    // Process the deposit
    await processNewDeposit(
      txn,
      near,
      bitcoin,
      btcAtlasDepositAddress,
      globalParams.atlasTreasuryAddress,
    );

    res.json({
      success: true,
      message: `Successfully processed deposit for BTC transaction ${btcTxnHash}`,
    });
  } catch (error) {
    console.error("Error processing new deposit:", error);
    res.status(500).json({
      error: "Failed to process new deposit",
      details: error.message,
    });
  }
});

app.get("/api/v1/process-new-redemption", async (req, res) => {
  try {
    const { txnHash } = req.query;

    if (!txnHash) {
      return res
        .status(400)
        .json({ error: "Transaction hash is required" });
    }

    // Extract chainId from txnHash
    const [chainId, chainTxHash] = txnHash.split(',');

    if (!chainId) {
      return res
        .status(400)
        .json({ error: "Chain ID not found in transaction hash" });
    }

    // Get chain config for the specified chainId
    const chainConfig = getChainConfig(chainId);
    const { EVENT_NAME } = getConstants();

    if (!chainConfig) {
      return res
        .status(400)
        .json({ error: "Invalid chain ID" });
    }

    // Check if redemption record already exists
    const redemptionRecord = await near.getRedemptionByTxnHash(txnHash);
    if (redemptionRecord) {
      return res
        .status(409)
        .json({ error: "Redemption record already exists" });
    }

    const { DELIMITER } = getConstants();

    if (chainConfig.networkType === "NEAR") {
      // Fetch transaction from mempool
      const event = await near.fetchEventByTxnHashAndEventName(chainTxHash, "ft_burn_redeem");

      if (!event || event.length === 0) {
        return res
          .status(404)
          .json({ error: "Transaction not found in blockchain" });
      }

      console.log("event:", JSON.stringify(event, null, 2));

      // Check if amount is greater than 10000
      if (Number(event.returnValues.amount) < 10000) {
        return res
          .status(400)
          .json({ error: "Amount must be greater than 10000" });
      }

      await processBurnRedeemEvent(
        {
          returnValues: {
            wallet: event.returnValues.wallet,
            btcAddress: event.returnValues.btcAddress,
            amount: event.returnValues.amount,
          },
          transactionHash: event.transactionHash,
        },
        near,
        chainConfig.chainID,
        DELIMITER,
        event.timestamp,
      );
    } else if (chainConfig.networkType === "EVM") {
      const ethereum = new Ethereum(
        chainConfig.chainID,
        chainConfig.chainRpcUrl,
        chainConfig.gasLimit,
        chainConfig.aBTCAddress,
        chainConfig.abiPath,
      );

      // Fetch transaction from mempool
      const event = await ethereum.fetchEventByTxnHashAndEventName(chainTxHash, EVENT_NAME.BURN_REDEEM);

      const block = await ethereum.getBlock(event.blockNumber);
      const timestamp = Number(block.timestamp);

      if (!event || event.length === 0) {
        return res
          .status(404)
          .json({ error: "Transaction not found in blockchain" });
      }

      // Check if amount is greater than 10000
      if (Number(event.returnValues.amount) < 10000) {
        return res
          .status(400)
          .json({ error: "Amount must be greater than 10000" });
      }

      await processBurnRedeemEvent(
        {
          returnValues: {
            wallet: event.returnValues.wallet,
            btcAddress: event.returnValues.btcAddress,
            amount: event.returnValues.amount,
          },
          transactionHash: event.transactionHash,
        },
        near,
        chainConfig.chainID,
        DELIMITER,
        timestamp,
      );
    }

    res.json({
      success: true,
      message: `Successfully processed redemption for transaction ${txnHash}`,
    });
  } catch (error) {
    console.error("Error processing new redemption:", error);
    res.status(500).json({
      error: "Failed to process new redemption",
      details: error.message,
    });
  }
});

// Queue for processing BTC pubkey insertions
const insertPubkeyQueue = [];
let isProcessing = false;

async function processPubkeyQueue() {
  if (isProcessing || insertPubkeyQueue.length === 0) return;

  isProcessing = true;
  const { btcAddress, publicKey, res } = insertPubkeyQueue.shift();

  try {
    await near.insertBtcPubkey(btcAddress, publicKey);
    res.json({
      success: true,
      message: "Successfully processed BTC pubkey",
    });
  } catch (error) {
    console.error("Error processing BTC pubkey:", error);
    res.status(500).json({
      error: "Failed to process BTC pubkey",
      details: error.message,
    });
  }

  isProcessing = false;
  processPubkeyQueue(); // Process next item in queue
}

app.get("/api/v1/insert-btc-pubkey", async (req, res) => {
  try {
    const { btcAddress, publicKey } = req.query;
    if (!btcAddress || !publicKey) {
      return res.status(400).json({
        error: "Both BTC address and public key are required",
      });
    }

    // Check if address already exists before queueing
    const existingPubkey = await near.getPubkeyByAddress(btcAddress);
    if (existingPubkey) {
      console.log("BTC address already has an associated public key");
      return res.status(409).json({
        error: "BTC address already has an associated public key",
      });
    }

    // Add request to queue if pubkey doesn't exist
    insertPubkeyQueue.push({ btcAddress, publicKey, res });
    processPubkeyQueue();
  } catch (error) {
    console.error("Error queueing BTC pubkey insertion:", error);
    res.status(500).json({
      error: "Failed to queue BTC pubkey insertion",
      details: error.message,
    });
  }
});

app.get("/api/v1/check-minted-txn", async (req, res) => {
  try {
    const { btcTxnHash, mintedTxnHash } = req.query;

    if (!btcTxnHash) {
      return res
        .status(400)
        .json({ error: "BTC transaction hash is required" });
    }

    if (!mintedTxnHash) {
      return res
        .status(400)
        .json({ error: "Minted transaction hash is required" });
    }

    const result = await checkAndUpdateMintedTxnHash(
      btcTxnHash,
      near,
      mintedTxnHash,
    );

    if (result) {
      res.json({
        success: true,
        message: `Successfully found and processed mint deposit event for BTC transaction ${btcTxnHash}`,
      });
    } else {
      res.json({
        success: false,
        message: `No mint deposit event found for BTC transaction ${btcTxnHash}`,
      });
    }
  } catch (error) {
    console.error("Error checking minted transaction:", error);
    res.status(500).json({
      error: "Failed to check minted transaction",
      details: error.message,
    });
  }
});

// API endpoint to update BTC transaction hash
app.get('/api/v1/update-send-to-user-btc-txn-hash', async (req, res) => {
  try {
      const result = await UpdateSendToUserBtcTxnHash.updateBtcTxnHash(bitcoin);
      
      if (result.success) {
          res.status(200).json({
              success: true,
              message: result.message,
              data: result.data
          });
      } else {
          res.status(400).json({
              success: false,
              message: result.message
          });
      }
  } catch (error) {
      console.error('Error in update-send-to-user-btc-txn-hash:', error);
      res.status(500).json({
          success: false,
          message: error.message || 'Internal server error'
      });
  }
});

async function runBatch() {
  await getBtcMempoolRecords();
  await getAllBridgingHistory();
  await computeStats();

  await RetrieveAndProcessPastEvmEvents(near, deposits, redemptions, bridgings);
  await RetrieveAndProcessPastNearEvents(
    near,
    deposits,
    redemptions,
    bridgings,
  );

  await UpdateAtlasBtcDeposits(
    btcMempool,
    btcAtlasDepositAddress,
    globalParams.atlasTreasuryAddress,
    near,
    bitcoin,
  );

  // await WithdrawFailDeposits(deposits, near, bitcoin);
  // await UpdateWithdrawFailDeposits(deposits, near, bitcoin);

  // await MintBridgeABtcToDestChain(near);
  // await SendBridgingFeesToTreasury(near, bitcoin);
  // await UpdateAtlasBtcBridgingYieldProviderWithdrawn(bridgings, near, bitcoin);

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

  console.log(`Server is running on port ${PORT} | ${nearConfig.contractId}`);

  runBatch().catch(console.error);

  //Add the unstaking and withdrawal process to the job scheduler
  // setInterval(async () => {
  //   try {
  //     await processUnstakingAndWithdrawal(
  //       near,
  //       bitcoin,
  //       redemptions,
  //       bridgings,
  //       globalParams.atlasTreasuryAddress,
  //     );
  //   } catch (error) {
  //     console.error("Error in unstaking and withdrawal process:", error);
  //   }
  // }, 60000); // Run every 1 minute

  setInterval(async () => {
    await getAllDepositHistory();
  }, 5000);

  setInterval(async () => {
    await getAllRedemptionHistory();
  }, 5000);

  setInterval(async () => {
    await getBithiveRecords();
  }, 10000);

  setInterval(async () => {
    await UpdateYieldProviderStaked(deposits, bithiveRecords, near);
  }, 10000);

  setInterval(async () => {
    await UpdateAtlasAbtcMinted(deposits, near);
  }, 10000);

  setInterval(async () => {
    await StakeToYieldProvider(deposits, near, bitcoin);
  }, 10000);

  setInterval(async () => {
    await MintaBtcToReceivingChain(deposits, near);
  }, 10000);

  setInterval(async () => {
    await UpdateAtlasBtcDeposited(deposits, near, bitcoin);
  }, 10000);
  
  setInterval(async () => {
    await UpdateAtlasBtcWithdrawingFromYieldProvider(redemptions, bridgings, near);
  }, 10000);

  setInterval(async () => {
    await UpdateAtlasBtcWithdrawnFromYieldProvider(redemptions, near, bithiveRecords);
  }, 10000);

  setInterval(async () => {
    await SendBtcBackToUser(near, redemptions, bitcoin);
  }, 10000);

  setInterval(async () => {
    await UpdateAtlasRedemptionPendingBtcMempool(near, redemptions);
  }, 10000);

  setInterval(async () => {
    await UpdateAtlasBtcBackToUser(redemptions, near, bitcoin);
  }, 10000);
});


