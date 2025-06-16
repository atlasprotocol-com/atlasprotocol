/**
 * @fileoverview Helper functions for managing redemption operations in the Atlas Protocol
 * This module provides utilities for validating, updating, and retrieving redemption records
 * from the NEAR blockchain with support for batch processing and concurrent operations.
 */

const { flagsBatch } = require("../utils/batchFlags");
const { getChainConfig } = require("../utils/network.chain.config");
const { getConstants } = require("../constants");

/**
 * Validates common redemption record fields to ensure data integrity
 * Checks for required fields, proper formatting, and valid chain configuration
 * 
 * @param {Object} redemption - Redemption record object to validate
 * @param {string} redemption.remarks - Remarks field (should be empty for valid redemptions)
 * @param {string} redemption.abtc_redemption_chain_id - Chain ID for the redemption
 * @param {number} redemption.verified_count - Number of validators that have verified this redemption
 * @returns {Object} Validation result object
 * @returns {boolean} returns.isValid - Whether the redemption passes all validation checks
 * @returns {Object|null} returns.chainConfig - Chain configuration object if valid, null otherwise
 */
const validateCommonRedemptionFields = (redemption) => {
  try {
    // Get chain configuration for the redemption chain
    const chainConfig = getChainConfig(redemption.abtc_redemption_chain_id);

    // Validate all required fields and their constraints
    const isValid =
      redemption.remarks === "" && // Remarks should be empty for valid redemptions
      redemption.verified_count >= chainConfig.validators_threshold; // Must meet validator threshold

    return { isValid, chainConfig };
  } catch (error) {
    // Log error and return invalid result if chain config cannot be retrieved
    const remarks = `[validateCommonRedemptionFields] Chain config not found for chain ID: ${redemption.abtc_redemption_chain_id}`;
    console.log(remarks);
    return { isValid: false, chainConfig: null };
  }
};

/**
 * Fetches all redemption history from NEAR blockchain with optimized pagination and concurrency control
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
 * @param {Object} near - NEAR blockchain instance with getAllRedemptions and getTotalRedemptionsCount methods
 * @param {number} [limit=1000] - Number of records to fetch per batch (default: 1000)
 * @param {number} [concurrentLimit=5] - Maximum number of concurrent batch requests (default: 5)
 * @returns {Promise<Array<Object>>} Promise that resolves to an array of all redemption records
 * @returns {Promise<Array>} Returns empty array if no redemptions found or on error
 */
const getAllRedemptionHistory = async (near, limit = 1000, concurrentLimit = 5) => {
  // Prevent concurrent executions to avoid data inconsistency
  if (flagsBatch.GetAllRedemptionHistoryRunning) {
    console.log(
      "[getAllRedemptionHistory] GetAllRedemptionHistoryRunning is running",
    );
    return;
  }

  // Set global flag to prevent concurrent executions
  flagsBatch.GetAllRedemptionHistoryRunning = true;

  try {
    // Fetch first batch to check if redemptions exist and get initial data
    const firstBatch = await near.getAllRedemptions(0, limit);

    // Return early if no redemptions found
    if (firstBatch.length === 0) {
      console.log("[getAllRedemptionHistory] No redemptions found");
      return [];
    }

    // Initialize result array with first batch
    let allRedemptions = [...firstBatch];

    // Get total count to calculate required number of batches
    const totalCount = await near.getTotalRedemptionsCount();
    const totalBatches = Math.ceil(totalCount / limit);

    // Process remaining batches in chunks to limit concurrent requests
    for (let i = 1; i < totalBatches; i += concurrentLimit) {
      const batchPromises = [];
      const end = Math.min(i + concurrentLimit, totalBatches);

      // Create promises for current chunk of batches
      for (let j = i; j < end; j++) {
        const currentOffset = j * limit;
        batchPromises.push(near.getAllRedemptions(currentOffset, limit));
      }

      // Execute current chunk of batches in parallel
      const batchResults = await Promise.all(batchPromises);

      // Combine results from current chunk into main array
      batchResults.forEach((batch) => {
        allRedemptions = allRedemptions.concat(batch);
      });

      // Add small delay between chunks to prevent API overload
      if (i + concurrentLimit < totalBatches) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Log final result count
    console.log(
      "[getAllRedemptionHistory] Total redemptions fetched:",
      allRedemptions.length,
    );

    return allRedemptions;
  } catch (error) {
    // Log error and return empty array on failure
    console.error(`[getAllRedemptionHistory] Failed: ${error.message}`);
    return [];
  } finally {
    // Always reset the global flag, even if an error occurred
    flagsBatch.GetAllRedemptionHistoryRunning = false;
  }
};

/**
 * Updates the status of a specific redemption record in the provided array
 * This function modifies the redemption array in-place by finding the redemption
 * with the matching transaction hash and updating its status field
 * 
 * @param {Array<Object>} allRedemptions - Array of redemption records to search through
 * @param {string} txnHash - Transaction hash to identify the redemption
 * @param {string} newStatus - New status value to assign to the redemption
 * @returns {Promise<void>} Promise that resolves when the update is complete
 */
const updateOffchainRedemptionStatus = async (allRedemptions, txnHash, newStatus) => {
  // Find the index of the redemption with matching transaction hash
  const index = allRedemptions.findIndex(r => r.txn_hash === txnHash);
  
  if (index !== -1) {
    // Update the status if redemption is found
    allRedemptions[index].status = newStatus;
    allRedemptions[index].timestamp = Math.floor(Date.now() / 1000);
    console.log(`[updateOffchainRedemptionStatus] Updated status for redemption ${txnHash} to ${newStatus}`);
  }
  
  // Explicitly return to make async behavior intentional
  return Promise.resolve();
};

const updateOffchainYieldProviderWithdrawing = async (allRedemptions, txnHash, newStatus, yieldProviderWithdrawalTxHash, withdrawalFee) => {
  const index = allRedemptions.findIndex(r => r.txn_hash === txnHash);
  if (index !== -1) {
    allRedemptions[index].status = newStatus;
    allRedemptions[index].yield_provider_txn_hash = yieldProviderWithdrawalTxHash;
    allRedemptions[index].yield_provider_gas_fee = withdrawalFee;
    allRedemptions[index].timestamp = Math.floor(Date.now() / 1000);
    console.log(`[updateOffchainYieldProviderWithdrawing] Updated status for redemption ${txnHash} to ${newStatus}`);
  }

  return Promise.resolve();
};

const updateOffPendingBtcMempool = async (allRedemptions, txnHash, newStatus, btcTxnHash) => {
  const index = allRedemptions.findIndex(r => r.txn_hash === txnHash);
  if (index !== -1) {
    allRedemptions[index].status = newStatus;
    allRedemptions[index].btc_txn_hash = btcTxnHash;
    allRedemptions[index].timestamp = Math.floor(Date.now() / 1000);
    console.log(`[updateOffPendingBtcMempool] Updated status for redemption ${txnHash} to ${newStatus}`);
  }

  return Promise.resolve();
};

/**
 * Updates the remarks field of a specific redemption record in the provided array
 * This function modifies the redemption array in-place by finding the redemption
 * with the matching transaction hash and updating its remarks field
 * 
 * @param {Array<Object>} allRedemptions - Array of redemption records to search through
 * @param {string} txnHash - Transaction hash to identify the redemption
 * @param {string} newRemarks - New remarks to assign to the redemption
 * @returns {Promise<void>} Promise that resolves when the update is complete
 */
const updateOffchainRedemptionRemarks = async (allRedemptions, txnHash, newRemarks) => {
  // Find the index of the redemption with matching transaction hash
  const index = allRedemptions.findIndex(r => r.txn_hash === txnHash);
  
  if (index !== -1) {
    // Update the remarks if redemption is found
    allRedemptions[index].remarks = newRemarks;
    allRedemptions[index].timestamp = Math.floor(Date.now() / 1000);
    console.log(`[updateOffchainRedemptionRemarks] Updated remarks for redemption ${txnHash} to ${newRemarks}`);
  }
  
  // Explicitly return to make async behavior intentional
  return Promise.resolve();
};

/**
 * Filters redemption records to find those that are pending withdrawal processing
 * This function identifies redemptions that have been unstaked from the yield provider
 * and are ready for the withdrawal process to begin
 * 
 * @param {Array<Object>} allRedemptions - Array of all redemption records to filter
 * @returns {Promise<Array<Object>>} Promise that resolves to array of redemptions pending withdrawal processing
 */
const getPendingRedemptionsForWithdrawal = async (allRedemptions) => {
  // Get redemption status constants
  const { REDEMPTION_STATUS } = getConstants();
  
  // Filter redemptions based on validation and status criteria
  const filteredRedemptions = allRedemptions.filter(redemption => {
    // Validate common redemption fields
    const { isValid } = validateCommonRedemptionFields(redemption);

    // Return true if redemption is valid and meets withdrawal criteria
    return isValid && 
      redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING && 
      redemption.yield_provider_txn_hash === ""; // No yield provider transaction hash yet
  });
  
  // Explicitly return the filtered redemptions as a Promise
  return Promise.resolve(filteredRedemptions);
};

/**
 * Filters redemption records to find those currently being withdrawn from yield provider
 * This function identifies redemptions that are in the active withdrawal process
 * and have associated gas fees for the withdrawal transaction
 * 
 * @param {Array<Object>} allRedemptions - Array of all redemption records to filter
 * @returns {Promise<Array<Object>>} Promise that resolves to array of redemptions currently being withdrawn
 */
const getWithdrawingFromYieldProvider = async (allRedemptions) => {
  // Get redemption status constants
  const { REDEMPTION_STATUS } = getConstants();

  // Filter redemptions based on validation and withdrawal status criteria
  const filteredRedemptions = allRedemptions.filter(redemption => {
    // Validate common redemption fields
    const { isValid } = validateCommonRedemptionFields(redemption);

    // Return true if redemption is valid and is actively being withdrawn
    return isValid && 
      redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWING && 
      redemption.yield_provider_txn_hash !== "" && // Must have yield provider transaction hash
      redemption.yield_provider_gas_fee !== 0; // Must have gas fee for withdrawal
  });
  
  // Explicitly return the filtered redemptions as a Promise
  return Promise.resolve(filteredRedemptions);
};

/**
 * Filters redemption records to find those that are pending unstaking from yield provider
 * This function identifies redemptions that have been burned (ABTC_BURNT status)
 * and are ready to be unstaked from the yield provider
 * 
 * @param {Array<Object>} allRedemptions - Array of all redemption records to filter
 * @returns {Promise<Array<Object>>} Promise that resolves to array of redemptions eligible for unstaking
 */
const getPendingRedemptionsForUnstake = async (allRedemptions) => {
  // Get redemption status constants
  const { REDEMPTION_STATUS } = getConstants();

  try {
    // Filter redemptions that meet unstaking criteria
    const pendingRedemptions = allRedemptions.filter(redemption => {
      try {
        // Use the common validation helper
        const { isValid } = validateCommonRedemptionFields(redemption);
        
        // Additional criteria specific to unstaking:
        // 1. Status is ABTC_BURNT (tokens have been burned)
        // 2. No yield provider transaction hash yet (not yet unstaked)
        return (
          isValid &&
          redemption.status === REDEMPTION_STATUS.ABTC_BURNT &&
          redemption.yield_provider_txn_hash === ""
        );
      } catch (error) {
        // Log error for individual redemption processing failures
        console.error(`[getPendingRedemptionsForUnstake] Error processing redemption ${redemption.txn_hash}:`, error);
        return false;
      }
    });

    // Explicitly return the filtered redemptions as a Promise
    return Promise.resolve(pendingRedemptions);
  } catch (error) {
    // Log error for overall function failures
    console.error("[getPendingRedemptionsForUnstake] Error:", error);
    return Promise.resolve([]);
  }
};

/**
 * Filters redemption records to find those that have been successfully withdrawn
 * This function identifies redemptions that have completed the withdrawal process
 * from the yield provider and are ready for final processing
 * 
 * @param {Array<Object>} allRedemptions - Array of all redemption records to filter
 * @returns {Promise<Array<Object>>} Promise that resolves to array of redemptions that have been withdrawn
 */
const getWithdrawRedemptions = async (allRedemptions) => {
  // Get redemption status constants
  const { REDEMPTION_STATUS } = getConstants();

  // Filter redemptions based on validation and withdrawal completion criteria
  const filteredRedemptions = allRedemptions.filter(redemption => {
    // Validate common redemption fields
    const { isValid } = validateCommonRedemptionFields(redemption);

    // Return true if redemption is valid and has been successfully withdrawn
    return isValid && 
      redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWN && 
      redemption.yield_provider_txn_hash !== "" && // Must have yield provider transaction hash
      redemption.yield_provider_gas_fee > 0; // Must have positive gas fee
  });
  
  // Explicitly return the filtered redemptions as a Promise
  return Promise.resolve(filteredRedemptions);
};

/**
 * Filters redemption records to find those ready for final processing to redeemed status
 * This function identifies redemptions that have been confirmed in the mempool
 * and meet all validation thresholds for final redemption processing
 * 
 * @param {Array<Object>} allRedemptions - Array of all redemption records to filter
 * @returns {Promise<Array<Object>>} Promise that resolves to array of redemptions ready for final processing
 */
const getRedemptionsToBeProcessedToRedeemed = async (allRedemptions) => {
  // Get redemption status constants
  const { REDEMPTION_STATUS } = getConstants();
  
  // Filter redemptions based on comprehensive validation criteria
  const filteredTxns = allRedemptions.filter((redemption) => {
    try {
      // Validate common redemption fields and get chain configuration
      const { isValid, chainConfig } = validateCommonRedemptionFields(redemption);

      // Return true if redemption meets all final processing criteria
      return isValid &&
        redemption.status === REDEMPTION_STATUS.BTC_PENDING_MEMPOOL_CONFIRMATION &&
        redemption.yield_provider_txn_hash !== "" && // Must have yield provider transaction hash
        redemption.yield_provider_gas_fee !== 0 && // Must have gas fee
        redemption.btc_txn_hash_verified_count >= chainConfig.validators_threshold; // Must meet validator threshold
    } catch (error) {
      // Log error if chain configuration cannot be retrieved
      const remarks = `Chain config not found for chain ID: ${redemption.abtc_redemption_chain_id}`;
      console.log(remarks);
      return false;
    }
  });
  
  // Explicitly return the filtered redemptions as a Promise
  return Promise.resolve(filteredTxns);
};

/**
 * Merges redemption records from blockchain with local records based on timestamps
 * Retains newer records in local array and includes updated/new records from blockchain
 * @param {Array} localRedemptions - Current local redemption records
 * @param {Array} blockchainRedemptions - Redemption records from blockchain
 * @returns {Array} Merged redemption records
 */
const mergeRedemptionRecords = (localRedemptions, blockchainRedemptions) => {
  if (!blockchainRedemptions || blockchainRedemptions.length === 0) {
    return localRedemptions;
  }

  if (!localRedemptions || localRedemptions.length === 0) {
    return blockchainRedemptions;
  }

  // Create a map of existing local redemptions by txn_hash for quick lookup
  const localRedemptionsMap = new Map();
  localRedemptions.forEach(redemption => {
    localRedemptionsMap.set(redemption.txn_hash, redemption);
  });

  // Create a map of blockchain redemptions by txn_hash
  const blockchainRedemptionsMap = new Map();
  blockchainRedemptions.forEach(redemption => {
    blockchainRedemptionsMap.set(redemption.txn_hash, redemption);
  });

  const mergedRedemptions = [];

  // Process all local redemptions
  localRedemptions.forEach(localRedemption => {
    const blockchainRedemption = blockchainRedemptionsMap.get(localRedemption.txn_hash);
    
    if (blockchainRedemption) {
      // Record exists in both - keep the one with newer timestamp
      if (blockchainRedemption.timestamp > localRedemption.timestamp) {
        mergedRedemptions.push(blockchainRedemption);
        // console.log(`[mergeRedemptionRecords] Updated redemption ${localRedemption.txn_hash} with newer blockchain data`);
      } else {
        mergedRedemptions.push(localRedemption);
        // console.log(`[mergeRedemptionRecords] Kept local redemption ${localRedemption.txn_hash} (newer timestamp)`);
      }
    } else {
      // Record only exists locally - keep it
      mergedRedemptions.push(localRedemption);
      // console.log(`[mergeRedemptionRecords] Kept local-only redemption ${localRedemption.txn_hash}`);
    }
  });

  // Add new records from blockchain that don't exist locally
  blockchainRedemptions.forEach(blockchainRedemption => {
    if (!localRedemptionsMap.has(blockchainRedemption.txn_hash)) {
      mergedRedemptions.push(blockchainRedemption);
      // console.log(`[mergeRedemptionRecords] Added new redemption ${blockchainRedemption.txn_hash} from blockchain`);
    }
  });

  // Sort by timestamp (newest first)
  mergedRedemptions.sort((a, b) => b.timestamp - a.timestamp);

  // console.log(`[mergeRedemptionRecords] Merged ${localRedemptions.length} local + ${blockchainRedemptions.length} blockchain = ${mergedRedemptions.length} total redemptions`);
  
  return mergedRedemptions;
};

// Export all helper functions for use in other modules
module.exports = {
  getAllRedemptionHistory,
  updateOffchainRedemptionStatus,
  updateOffchainRedemptionRemarks,
  getPendingRedemptionsForWithdrawal,
  getPendingRedemptionsForUnstake,
  getWithdrawingFromYieldProvider,
  getWithdrawRedemptions,
  getRedemptionsToBeProcessedToRedeemed,
  mergeRedemptionRecords,
  updateOffchainYieldProviderWithdrawing,
  updateOffPendingBtcMempool
};  