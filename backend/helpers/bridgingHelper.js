/**
 * @fileoverview Helper functions for managing bridging operations in the Atlas Protocol
 * This module provides utilities for validating, updating, and retrieving bridging records
 * from the NEAR blockchain with support for batch processing and concurrent operations.
 */

const { flagsBatch } = require("../utils/batchFlags");
const { getChainConfig } = require("../utils/network.chain.config");
const { getConstants } = require("../constants");

/**
 * Validates common bridging record fields to ensure data integrity
 * Checks for required fields, proper formatting, and valid chain configuration
 * 
 * @param {Object} bridging - Bridging record object to validate
 * @param {string} bridging.origin_chain_id - Source chain ID (must be non-empty)
 * @param {string} bridging.origin_chain_address - Source chain address (must be non-empty)
 * @param {string} bridging.dest_chain_id - Destination chain ID (must be non-empty)
 * @param {string} bridging.dest_chain_address - Destination chain address (must be non-empty)
 * @param {string} bridging.remarks - Remarks field (should be empty for valid bridgings)
 * @param {number} bridging.verified_count - Number of validators that have verified this bridging
 * @returns {Object} Validation result object
 * @returns {boolean} returns.isValid - Whether the bridging passes all validation checks
 * @returns {Object|null} returns.chainConfig - Chain configuration object if valid, null otherwise
 */
const validateCommonBridgingFields = (bridging) => {
  try {
    // Get chain configuration for the destination chain
    const chainConfig = getChainConfig(bridging.dest_chain_id);

    // Validate all required fields and their constraints
    const isValid =
      bridging.origin_chain_id !== "" && // Origin chain ID must be non-empty
      bridging.origin_chain_address !== "" && // Origin chain address must be non-empty
      bridging.dest_chain_id !== "" && // Destination chain ID must be non-empty
      bridging.dest_chain_address !== "" && // Destination chain address must be non-empty
      bridging.remarks === "" && // Remarks should be empty for valid bridgings
      bridging.verified_count >= chainConfig.validators_threshold; // Must meet validator threshold

    return { isValid, chainConfig };
  } catch (error) {
    // Log error and return invalid result if chain config cannot be retrieved
    const remarks = `[validateCommonBridgingFields] Chain config not found for chain ID: ${bridging.dest_chain_id}`;
    console.log(remarks);
    return { isValid: false, chainConfig: null };
  }
};

/**
 * Fetches all bridging history from NEAR blockchain with optimized pagination and concurrency control
 * This function implements a sophisticated batching strategy to efficiently retrieve large datasets
 * while preventing memory issues and API rate limiting
 * 
 * Features:
 * - Prevents concurrent executions using a global flag
 * - Implements pagination with configurable batch sizes
 * - Limits concurrent requests to prevent API overload
 * - Handles empty datasets gracefully
 * - Provides progress logging and error handling
 * 
 * @param {Object} near - NEAR blockchain instance with getAllBridgings and getTotalBridgingCount methods
 * @param {number} [limit=1000] - Number of records to fetch per batch (default: 1000)
 * @param {number} [concurrentLimit=5] - Maximum number of concurrent batch requests (default: 5)
 * @returns {Promise<Array<Object>>} Promise that resolves to an array of all bridging records
 * @returns {Promise<Array>} Returns empty array if no bridgings found or on error
 */
const getAllBridgingHistory = async (
  near,
  limit = 1000,
  concurrentLimit = 5,
) => {
  // Prevent concurrent executions to avoid data inconsistency
  if (flagsBatch.GetAllBridgingHistoryRunning) {
    console.log(
      "[getAllBridgingHistory] GetAllBridgingHistoryRunning is running",
    );
    return;
  }

  // Set global flag to prevent concurrent executions
  flagsBatch.GetAllBridgingHistoryRunning = true;

  try {
    // Fetch first batch to check if bridgings exist and get initial data
    const firstBatch = await near.getAllBridgings(0, limit);

    // Return early if no bridgings found
    if (firstBatch.length === 0) {
      console.log("[getAllBridgingHistory] No bridgings found");
      return [];
    }

    // Initialize result array with first batch
    let allBridgings = [...firstBatch];

    // Get total count to calculate required number of batches
    const totalCount = await near.getTotalBridgingCount();
    const totalBatches = Math.ceil(totalCount / limit);

    // Process remaining batches in chunks to limit concurrent requests
    for (let i = 1; i < totalBatches; i += concurrentLimit) {
      const batchPromises = [];
      const end = Math.min(i + concurrentLimit, totalBatches);

      // Create promises for current chunk of batches
      for (let j = i; j < end; j++) {
        const currentOffset = j * limit;
        batchPromises.push(near.getAllBridgings(currentOffset, limit));
      }

      // Execute current chunk of batches in parallel
      const batchResults = await Promise.all(batchPromises);

      // Combine results from current chunk into main array
      batchResults.forEach((batch) => {
        allBridgings = allBridgings.concat(batch);
      });

      // Add small delay between chunks to prevent API overload
      if (i + concurrentLimit < totalBatches) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Log final result count
    console.log(
      "[getAllBridgingHistory] Total bridgings fetched:",
      allBridgings.length,
    );

    return allBridgings;
  } catch (error) {
    // Log error and return empty array on failure
    console.error(`[getAllBridgingHistory] Failed: ${error.message}`);
    return [];
  } finally {
    // Always reset the global flag, even if an error occurred
    flagsBatch.GetAllBridgingHistoryRunning = false;
  }
};

/**
 * Filters bridging records to find those that are ready to be bridged
 * This function identifies bridgings that have been burned (ABTC_BURNT status)
 * and are ready for the bridging process to begin
 * 
 * @param {Array<Object>} allBridgings - Array of all bridging records to filter
 * @returns {Promise<Array<Object>>} Promise that resolves to array of bridging records ready to be bridged
 */
const getBridgingRecordsToBridge = async (allBridgings) => {
  // Get bridging status constants
  const { BRIDGING_STATUS } = getConstants();
  
  // Filter bridgings based on validation and bridging criteria
  const filteredBridgings = allBridgings.filter((bridging) => {
    // Validate common bridging fields
    const { isValid } = validateCommonBridgingFields(bridging);

    // Return true if bridging is valid and ready for bridging process
    return (
      isValid &&
      bridging.status === BRIDGING_STATUS.ABTC_BURNT && // Must be in burned status
      bridging.dest_txn_hash === "" // No destination transaction hash yet
    );
  });
  
  // Explicitly return the filtered bridgings as a Promise
  return Promise.resolve(filteredBridgings);
};

/**
 * Filters bridging records to find those that are ready to be minted
 * This function identifies bridgings that have been processed and are ready
 * for minting on the destination chain
 * 
 * @param {Array<Object>} allBridgings - Array of all bridging records to filter
 * @returns {Promise<Array<Object>>} Promise that resolves to array of bridging records ready to be minted
 */
const getBridgingRecordsToUpdateMinted = async (allBridgings) => {
  // Get bridging status constants
  const { BRIDGING_STATUS } = getConstants();
  
  // Filter bridgings based on validation and minting criteria
  const filteredBridgings = allBridgings.filter((bridging) => {
    // Validate common bridging fields and get chain configuration
    const { isValid, chainConfig } = validateCommonBridgingFields(bridging);

    // Return true if bridging meets all minting criteria
    return (
      isValid &&
      (bridging.status ===
        BRIDGING_STATUS.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST ||
        bridging.status === BRIDGING_STATUS.ABTC_BURNT) && // Must be in pending or burned status
      bridging.dest_txn_hash !== "" && // Must have destination transaction hash
      bridging.minted_txn_hash_verified_count >=
        chainConfig.validators_threshold // Must meet validator threshold
    );
  });
  
  // Explicitly return the filtered bridgings as a Promise
  return Promise.resolve(filteredBridgings);
};

/**
 * Updates the status of a specific bridging record in the provided array
 * This function modifies the bridging array in-place by finding the bridging
 * with the matching transaction hash and updating its status field
 * 
 * @param {Array<Object>} allBridgings - Array of bridging records to search through
 * @param {string} txnHash - Transaction hash to identify the bridging
 * @param {string} newStatus - New status value to assign to the bridging
 * @returns {Promise<void>} Promise that resolves when the update is complete
 */
const updateOffchainBridgingStatus = async (
  allBridgings,
  txnHash,
  newStatus,
) => {
  // Find the index of the bridging with matching transaction hash
  const index = allBridgings.findIndex((b) => b.txn_hash === txnHash);
  
  if (index !== -1) {
    // Update the status if bridging is found
    allBridgings[index].status = newStatus;
    allBridgings[index].timestamp = Math.floor(Date.now() / 1000);
    console.log(
      `[updateOffchainBridgingStatus] Updated status for bridging ${txnHash} to ${newStatus}`,
    );
  }
  
  // Explicitly return to make async behavior intentional
  return Promise.resolve();
};

/**
 * Updates the remarks field of a specific bridging record in the provided array
 * This function modifies the bridging array in-place by finding the bridging
 * with the matching transaction hash and updating its remarks field
 * 
 * @param {Array<Object>} allBridgings - Array of bridging records to search through
 * @param {string} txnHash - Transaction hash to identify the bridging
 * @param {string} newRemarks - New remarks to assign to the bridging
 * @returns {Promise<void>} Promise that resolves when the update is complete
 */
const updateOffchainBridgingRemarks = async (
  allBridgings,
  txnHash,
  newRemarks,
) => {
  // Find the index of the bridging with matching transaction hash
  const index = allBridgings.findIndex((b) => b.txn_hash === txnHash);
  
  if (index !== -1) {
    // Update the remarks if bridging is found
    allBridgings[index].remarks = newRemarks;
    allBridgings[index].timestamp = Math.floor(Date.now() / 1000);
    console.log(
      `[updateOffchainBridgingRemarks] Updated remarks for bridging ${txnHash} to ${newRemarks}`,
    );
  }
  
  // Explicitly return to make async behavior intentional
  return Promise.resolve();
};

const updateOffchainBridgingYieldProviderRemarks = async (allBridgings, txnHash, newRemarks) => {
  const index = allBridgings.findIndex((b) => b.txn_hash === txnHash);
  if (index !== -1) {
    allBridgings[index].yield_provider_remarks = newRemarks;
    allBridgings[index].timestamp = Math.floor(Date.now() / 1000);
  }
};

/**
 * Updates the minted transaction hash of a specific bridging record
 * This function modifies the bridging array in-place by finding the bridging
 * with the matching transaction hash and updating its destination transaction hash
 * 
 * @param {Array<Object>} allBridgings - Array of bridging records to search through
 * @param {string} txnHash - Original transaction hash to identify the bridging
 * @param {string} mintedTxnHash - New minted transaction hash to assign
 * @returns {Promise<void>} Promise that resolves when the update is complete
 */
const updateOffchainBridgingMintedTxnHash = async (
  allBridgings,
  txnHash,
  mintedTxnHash,
) => {
  // Find the index of the bridging with matching transaction hash
  const index = allBridgings.findIndex((b) => b.txn_hash === txnHash);
  
  if (index !== -1) {
    // Update the destination transaction hash if bridging is found
    allBridgings[index].dest_txn_hash = mintedTxnHash;
    allBridgings[index].timestamp = Math.floor(Date.now() / 1000);
    console.log(
      `[updateOffchainBridgingMintedTxnHash] Updated minted transaction hash for bridging ${txnHash} to ${mintedTxnHash}`,
    );
  }
  
  // Explicitly return to make async behavior intentional
  return Promise.resolve();
};

/**
 * Filters bridging records to find those that are ready for unstaking fees
 * This function identifies bridgings that have been minted to destination
 * and are ready for yield provider unstaking fee processing
 * 
 * @param {Array<Object>} allBridgings - Array of all bridging records to filter
 * @returns {Promise<Array<Object>>} Promise that resolves to array of bridging records ready for unstaking fees
 */
const getBridgingFeesForUnstake = async (allBridgings) => {
  // Get bridging status constants
  const { BRIDGING_STATUS } = getConstants();
  
  // Filter bridgings based on validation and unstaking fee criteria
  const filteredBridgings = allBridgings.filter((bridging) => {
    // Validate common bridging fields and get chain configuration
    const { isValid, chainConfig } = validateCommonBridgingFields(bridging);  
    
    // Return true if bridging is valid and ready for unstaking fee processing
    return (
      isValid &&
      bridging.status === BRIDGING_STATUS.ABTC_MINTED_TO_DEST && // Must be minted to destination
      bridging.yield_provider_status === BRIDGING_STATUS.ABTC_BURNT && // Yield provider must be burned
      bridging.yield_provider_remarks === "" &&
      bridging.yield_provider_txn_hash === "" &&
      bridging.yield_provider_gas_fee === 0
    );
  });
  
  // Explicitly return the filtered bridgings as a Promise
  return Promise.resolve(filteredBridgings);
};

/**
 * Filters bridging records to find those that are pending withdrawal fee processing
 * This function identifies bridgings that are currently being withdrawn
 * and are ready for withdrawal fee processing
 * 
 * @param {Array<Object>} allBridgings - Array of all bridging records to filter
 * @returns {Promise<Array<Object>>} Promise that resolves to array of bridging records pending withdrawal fees
 */
const getPendingBridgingFeesForWithdrawal = async (allBridgings) => {
  // Get bridging status constants
  const { BRIDGING_STATUS } = getConstants();
  
  // Filter bridgings based on validation and withdrawal fee criteria
  const filteredBridgings = allBridgings.filter((bridging) => {
    // Validate common bridging fields and get chain configuration
    const { isValid, chainConfig } = validateCommonBridgingFields(bridging);  
    
    // Return true if bridging is valid and is currently being withdrawn
    return (
      isValid &&
      bridging.status === BRIDGING_STATUS.ABTC_MINTED_TO_DEST && // Must be minted to destination
      bridging.yield_provider_status === BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING &&// Must be in withdrawing status
      bridging.yield_provider_remarks === "" &&
      bridging.yield_provider_txn_hash === "" &&
      bridging.yield_provider_gas_fee === 0
    );
  });
  
  // Explicitly return the filtered bridgings as a Promise
  return Promise.resolve(filteredBridgings);
};

const getPendingBridgingFeesWithdrawing = async (allBridgings) => {
  const { BRIDGING_STATUS } = getConstants();
  const filteredBridgings = allBridgings.filter((bridging) => {

    const { isValid, chainConfig } = validateCommonBridgingFields(bridging);  

    return isValid &&
    bridging.yield_provider_status === BRIDGING_STATUS.ABTC_YIELD_PROVIDER_WITHDRAWING &&
    bridging.yield_provider_remarks === "" &&
    bridging.yield_provider_txn_hash !== "" &&
    bridging.yield_provider_gas_fee > 0 &&
    bridging.yield_provider_txn_hash !== "";
  });
  return Promise.resolve(filteredBridgings);
};

const updateOffchainBridgingYieldProviderStatus = async (allBridgings, txnHash, newStatus) => {
  const index = allBridgings.findIndex((b) => b.txn_hash === txnHash);
  if (index !== -1) {
    allBridgings[index].yield_provider_status = newStatus;
    allBridgings[index].timestamp = Math.floor(Date.now() / 1000);
    console.log(
      `[updateOffchainBridgingYieldProviderStatus] Updated yield provider status for bridging ${txnHash} to ${newStatus}`,
    );
  }
  return Promise.resolve();
};

/**
 * Merges bridging records from blockchain with local records based on timestamps
 * Retains newer records in local array and includes updated/new records from blockchain
 * @param {Array} localBridgings - Current local bridging records
 * @param {Array} blockchainBridgings - Bridging records from blockchain
 * @returns {Array} Merged bridging records
 */
const mergeBridgingRecords = (localBridgings, blockchainBridgings) => {
  if (!blockchainBridgings || blockchainBridgings.length === 0) {
    return localBridgings;
  }

  if (!localBridgings || localBridgings.length === 0) {
    return blockchainBridgings;
  }

  // Create a map of existing local bridgings by txn_hash for quick lookup
  const localBridgingsMap = new Map();
  localBridgings.forEach(bridging => {
    localBridgingsMap.set(bridging.txn_hash, bridging);
  });

  // Create a map of blockchain bridgings by txn_hash
  const blockchainBridgingsMap = new Map();
  blockchainBridgings.forEach(bridging => {
    blockchainBridgingsMap.set(bridging.txn_hash, bridging);
  });

  const mergedBridgings = [];

  // Process all local bridgings
  localBridgings.forEach(localBridging => {
    const blockchainBridging = blockchainBridgingsMap.get(localBridging.txn_hash);
    
    if (blockchainBridging) {
      // Record exists in both - keep the one with newer timestamp
      if (blockchainBridging.timestamp > localBridging.timestamp) {
        mergedBridgings.push(blockchainBridging);
        // console.log(`[mergeBridgingRecords] Updated bridging ${localBridging.txn_hash} with newer blockchain data`);
      } else {
        mergedBridgings.push(localBridging);
        // console.log(`[mergeBridgingRecords] Kept local bridging ${localBridging.txn_hash} (newer timestamp)`);
      }
    } else {
      // Record only exists locally - keep it
      mergedBridgings.push(localBridging);
      //console.log(`[mergeBridgingRecords] Kept local-only bridging ${localBridging.txn_hash}`);
    }
  });

  // Add new records from blockchain that don't exist locally
  blockchainBridgings.forEach(blockchainBridging => {
    if (!localBridgingsMap.has(blockchainBridging.txn_hash)) {
      mergedBridgings.push(blockchainBridging);
      // console.log(`[mergeBridgingRecords] Added new bridging ${blockchainBridging.txn_hash} from blockchain`);
    }
  });

  // Sort by timestamp (newest first)
  mergedBridgings.sort((a, b) => b.timestamp - a.timestamp);

  // console.log(`[mergeBridgingRecords] Merged ${localBridgings.length} local + ${blockchainBridgings.length} blockchain = ${mergedBridgings.length} total bridgings`);
  
  return mergedBridgings;
};

// Export all helper functions for use in other modules
module.exports = {
  getAllBridgingHistory,
  getBridgingRecordsToBridge,
  validateCommonBridgingFields,
  getBridgingRecordsToUpdateMinted,
  updateOffchainBridgingStatus,
  updateOffchainBridgingRemarks,
  updateOffchainBridgingMintedTxnHash,
  getBridgingFeesForUnstake,
  getPendingBridgingFeesForWithdrawal,
  getPendingBridgingFeesWithdrawing,
  updateOffchainBridgingYieldProviderStatus,
  updateOffchainBridgingYieldProviderRemarks,
  mergeBridgingRecords, 
};
