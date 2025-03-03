/* eslint-disable import/order */

const dotenv = require("dotenv");
const { globalParams, updateGlobalParams } = require("./config/globalParams");
const { getTransactionsAndComputeStats } = require("./utils/transactionStats");
const { UpdateAtlasBtcDeposits } = require("./utils/updateAtlasBtcDeposits");
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
  UpdateAtlasBtcRedemptions,
} = require("./utils/updateAtlasBtcRedemptions");
const { UpdateAtlasBtcBridgings } = require("./utils/updateAtlasBtcBridgings");
const {
  UpdateAtlasBridgeAbtcMinted,
} = require("./utils/updateAtlasBridgeAbtcMinted");
const {
  UpdateAtlasBtcBackToUser,
} = require("./utils/updateAtlasBtcBackToUser");
const {
  UpdateAtlasAbtcMintedTxnHash,
} = require("./utils/UpdateAtlasAbtcMintedTxnHash");
const { UpdateAtlasAbtcMinted } = require("./utils/updateAtlasAbtcMinted");
const {
  UpdateYieldProviderStacked,
} = require("./utils/updateYieldProviderStacked");
const {
  UpdateYieldProviderUnStacked,
} = require("./utils/updateYieldProviderUnStacked");
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
  UnStakeFromYieldProvider,
} = require("./utils/unStakeFromYieldProvider");
const {
  WithdrawFromYieldProvider,
} = require("./utils/withdrawFromYieldProvider");
const {
  UpdateAtlasBtcWithdrawnFromYieldProvider,
} = require("./utils/updateAtlasBtcWithdrawnFromYieldProvider");
const { SendBtcBackToUser } = require("./utils/sendBtcBackToUser");
const {
  estimateRedemptionFees,
  estimateBridgingFees,
} = require("./services/bithive");
const {
  UnstakeBridgingFeesFromYieldProvider,
} = require("./utils/unstakeBridgingFeesFromYieldProvider");
const {
  UpdateAtlasBtcBridgingYieldProviderUnstaked,
} = require("./utils/updateAtlasBtcBridgingYieldProviderUnstaked");
const {
  WithdrawBridgingFeesFromYieldProvider,
} = require("./utils/withdrawBridgingFeesFromYieldProvider");
const {
  UpdateAtlasBtcBridgingYieldProviderWithdrawn,
} = require("./utils/updateAtlasBtcBridgingYieldProviderWithdrawn");
const {
  RetrieveAndProcessPastNearEvents,
} = require("./utils/retrieveAndProcessPastNearEvents");

const {
  RetrieveAndProcessPastEvmEvents,
} = require("./utils/retrieveAndProcessPastEvmEvents");

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
const { Ethereum } = require("./services/ethereum");

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

const computeStats = async () => {
  atlasStats = await getTransactionsAndComputeStats(
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
    await getBtcMempoolRecords();
    await getAllDepositHistory();
    await getAllBridgingHistory();
    await getAllRedemptionHistory();
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

    await getBtcMempoolRecords();
    await computeStats();
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
        yield_provider_gas_fee: record.yield_provider_gas_fee,
        btc_redemption_fee: record.btc_redemption_fee,
        protocol_fee: record.protocol_fee,
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
    const { publicKey } = await bitcoin.deriveBTCAddress(near);
    const returnData = await getBithiveDeposits(publicKey.toString("hex"));
    res.status(200).json(returnData);
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

    let chainConfig = getChainConfig("421614");
    console.log(chainConfig);

    if (!chainConfig) {
      throw new Error("Chain config for '421614' is undefined");
    }

    const ethereum = new Ethereum(
      chainConfig.chainID, // Corrected property name
      chainConfig.chainRpcUrl, // Corrected property name
      chainConfig.gasLimit, // Corrected property name
      chainConfig.aBTCAddress, // Corrected property name
      chainConfig.abiPath, // Corrected property name
    );

    derivationPath = chainConfig.networkType; // Corrected property name
    console.log(derivationPath);

    if (!derivationPath) {
      throw new Error("chainConfig.networkType is undefined");
    }

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

async function runBatch() {
  await getBtcMempoolRecords();
  await getAllDepositHistory();
  await getAllBridgingHistory();
  await getAllRedemptionHistory();
  await computeStats();

  await UpdateAtlasBtcDeposits(
    btcMempool,
    btcAtlasDepositAddress,
    globalParams.atlasTreasuryAddress,
    globalParams.atlasDepositFeePercentage,
    near,
    bitcoin,
  );
  await StakeToYieldProvider(near, bitcoin);
  await UpdateYieldProviderStacked(deposits, near, bitcoin);
  await MintaBtcToReceivingChain(near);
  // await UpdateAtlasAbtcMintedTxnHash(deposits, near); // Not needed
  await UpdateAtlasAbtcMinted(deposits, near);

  await WithdrawFailDeposits(deposits, near, bitcoin);
  await UpdateWithdrawFailDeposits(deposits, near, bitcoin);

  // await UpdateAtlasBtcRedemptions(near); // Not needed
  await UnStakeFromYieldProvider(near, bitcoin);
  await UpdateYieldProviderUnStacked(redemptions, near, bitcoin);
  await WithdrawFromYieldProvider(redemptions, near, bitcoin);
  await UpdateAtlasBtcWithdrawnFromYieldProvider(redemptions, near, bitcoin);
  await SendBtcBackToUser(near, bitcoin);
  await UpdateAtlasBtcBackToUser(redemptions, near, bitcoin);

  // // await UpdateAtlasBtcBridgings(near); // Not needed
  await MintBridgeABtcToDestChain(near);
  // // await UpdateAtlasBridgeAbtcMinted(bridgings, near); // Not needed

  await UnstakeBridgingFeesFromYieldProvider(near, bitcoin);
  await UpdateAtlasBtcBridgingYieldProviderUnstaked(bridgings, near, bitcoin);
  await WithdrawBridgingFeesFromYieldProvider(
    near,
    bitcoin,
    bridgings,
    globalParams.atlasTreasuryAddress,
  );
  await UpdateAtlasBtcBridgingYieldProviderWithdrawn(bridgings, near, bitcoin);

  // await RetrieveAndProcessPastEvmEvents(near, deposits, redemptions, bridgings);
  // await RetrieveAndProcessPastNearEvents(near);

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

  runBatch().catch(console.error);
});
