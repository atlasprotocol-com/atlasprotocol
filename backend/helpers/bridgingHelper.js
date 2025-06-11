const { flagsBatch } = require("../utils/batchFlags");
const { getChainConfig } = require("../utils/network.chain.config");
const { getConstants } = require("../constants");

/**
 * Validates common bridging record fields
 * @param {Object} bridging - Bridging record to validate
 * @returns {Object} Object containing validation result and chain config if valid
 */
const validateCommonBridgingFields = (bridging) => {
  try {
    const chainConfig = getChainConfig(bridging.dest_chain_id);

    const isValid =
      bridging.origin_chain_id !== "" &&
      bridging.origin_chain_address !== "" &&
      bridging.dest_chain_id !== "" &&
      bridging.dest_chain_address !== "" &&
      bridging.remarks === "" &&
      bridging.verified_count >= chainConfig.validators_threshold;

    return { isValid, chainConfig };
  } catch (error) {
    const remarks = `[validateCommonBridgingFields] Chain config not found for chain ID: ${bridging.dest_chain_id}`;
    console.log(remarks);
    return { isValid: false, chainConfig: null };
  }
};

/**
 * Fetches all bridging history from NEAR with pagination and concurrent request limiting
 * @param {Object} near - NEAR instance
 * @param {number} limit - Number of records per batch
 * @param {number} concurrentLimit - Maximum number of concurrent requests
 * @returns {Promise<Array>} Array of bridging records
 */
const getAllBridgingHistory = async (
  near,
  limit = 1000,
  concurrentLimit = 5,
) => {
  if (flagsBatch.GetAllBridgingHistoryRunning) {
    console.log(
      "[getAllBridgingHistory] GetAllBridgingHistoryRunning is running",
    );
    return;
  }

  flagsBatch.GetAllBridgingHistoryRunning = true;

  try {
    // First, get the first batch to check if there are any bridgings
    const firstBatch = await near.getAllBridgings(0, limit);

    if (firstBatch.length === 0) {
      console.log("[getAllBridgingHistory] No bridgings found");
      return [];
    }

    let allBridgings = [...firstBatch];

    // Get total count from NEAR to calculate number of batches needed
    const totalCount = await near.getTotalBridgingCount();
    const totalBatches = Math.ceil(totalCount / limit);

    // Process batches in chunks to limit concurrent requests
    for (let i = 1; i < totalBatches; i += concurrentLimit) {
      const batchPromises = [];
      const end = Math.min(i + concurrentLimit, totalBatches);

      for (let j = i; j < end; j++) {
        const currentOffset = j * limit;
        batchPromises.push(near.getAllBridgings(currentOffset, limit));
      }

      // Fetch current chunk of batches in parallel
      const batchResults = await Promise.all(batchPromises);

      // Combine results from current chunk
      batchResults.forEach((batch) => {
        allBridgings = allBridgings.concat(batch);
      });

      // Optional: Add small delay between chunks to prevent overloading
      if (i + concurrentLimit < totalBatches) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      "[getAllBridgingHistory] Total bridgings fetched:",
      allBridgings.length,
    );

    return allBridgings;
  } catch (error) {
    console.error(`[getAllBridgingHistory] Failed: ${error.message}`);
    return [];
  } finally {
    flagsBatch.GetAllBridgingHistoryRunning = false;
  }
};

/**
 * Gets bridging records that are ready to be bridged based on chain configuration and status
 * @param {Array} allBridgings - Array of bridging records to validate
 * @returns {Array} Filtered array of bridging records ready to be bridged
 */
const getBridgingRecordsToBridge = (allBridgings) => {
  const { BRIDGING_STATUS } = getConstants();
  return allBridgings.filter((bridging) => {
    const { isValid } = validateCommonBridgingFields(bridging);

    return (
      isValid &&
      bridging.status === BRIDGING_STATUS.ABTC_BURNT &&
      bridging.dest_txn_hash === ""
    );
  });
};

/**
 * Gets bridging records that are ready to be minted based on chain configuration and status
 * @param {Array} allBridgings - Array of bridging records to validate
 * @returns {Array} Filtered array of bridging records ready to be minted
 */
const getBridgingRecordsToUpdateMinted = (allBridgings) => {
  const { BRIDGING_STATUS } = getConstants();
  return allBridgings.filter((bridging) => {
    const { isValid, chainConfig } = validateCommonBridgingFields(bridging);

    return (
      isValid &&
      (bridging.status === BRIDGING_STATUS.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST ||
        bridging.status === BRIDGING_STATUS.ABTC_BURNT) &&
        bridging.dest_txn_hash !== "" &&
        bridging.minted_txn_hash_verified_count >=
        chainConfig.validators_threshold
    );
  });
};

/**
 * Updates the status of a bridging record in the array
 * @param {Array} allBridgings - Array of bridging records
 * @param {string} txnHash - Transaction hash to update
 * @param {string} newStatus - New status to set
 */
const updateOffchainBridgingStatus = async (allBridgings, txnHash, newStatus) => {
  const index = allBridgings.findIndex(b => b.txn_hash === txnHash);
  if (index !== -1) {
    allBridgings[index].status = newStatus;
    console.log(`[updateOffchainBridgingStatus] Updated status for bridging ${txnHash} to ${newStatus}`);
  } 
};

/**
 * Updates the remarks of a bridging record in the array
 * @param {Array} allBridgings - Array of bridging records
 * @param {string} txnHash - Transaction hash to update
 * @param {string} newRemarks - New remarks to set
 */
const updateOffchainBridgingRemarks = async (allBridgings, txnHash, newRemarks) => {
  const index = allBridgings.findIndex(b => b.txn_hash === txnHash);
  if (index !== -1) {
    allBridgings[index].remarks = newRemarks;
    console.log(`[updateOffchainBridgingRemarks] Updated remarks for bridging ${txnHash} to ${newRemarks}`);
  }
};

/**
 * Updates the minted transaction hash of a bridging record in the array
 * @param {Array} allBridgings - Array of bridging records
 * @param {string} txnHash - Transaction hash to update
 * @param {string} mintedTxnHash - New minted transaction hash to set
 */
const updateOffchainBridgingMintedTxnHash = async (allBridgings, txnHash, mintedTxnHash) => {
  const index = allBridgings.findIndex(b => b.txn_hash === txnHash);
  if (index !== -1) {
    allBridgings[index].dest_txn_hash = mintedTxnHash;
    console.log(`[updateOffchainBridgingMintedTxnHash] Updated minted transaction hash for bridging ${txnHash} to ${mintedTxnHash}`);
  }
};

const getBridgingFeesForUnstake = (allBridgings) => { 
  const { BRIDGING_STATUS } = getConstants();
  return allBridgings.filter((bridging) => {
    return bridging.status === BRIDGING_STATUS.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST;
  });
};


module.exports = {
  getAllBridgingHistory,
  getBridgingRecordsToBridge,
  validateCommonBridgingFields,
  getBridgingRecordsToUpdateMinted,
  updateOffchainBridgingStatus,
  updateOffchainBridgingRemarks,
  updateOffchainBridgingMintedTxnHash,
  getBridgingFeesForUnstake,
};
