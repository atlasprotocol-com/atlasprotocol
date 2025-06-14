/**
 * @fileoverview Helper functions for managing deposit operations in the Atlas Protocol
 * This module provides utilities for validating, updating, and retrieving deposit records
 * from the NEAR blockchain with support for batch processing and concurrent operations.
 */

const { flagsBatch } = require("../utils/batchFlags");
const { getChainConfig } = require("../utils/network.chain.config");
const { getConstants } = require("../constants");

/**
 * Validates common deposit record fields to ensure data integrity
 * Checks for required fields, proper formatting, and valid chain configuration
 * 
 * @param {Object} deposit - Deposit record object to validate
 * @param {string} deposit.remarks - Remarks field (should be empty for new deposits)
 * @param {string} deposit.minted_txn_hash - Minted transaction hash (should be empty for new deposits)
 * @param {string} deposit.btc_sender_address - Bitcoin sender address (required, non-empty)
 * @param {string} deposit.receiving_chain_id - Target chain ID for the deposit
 * @param {string} deposit.receiving_address - Destination address on the receiving chain
 * @param {number} deposit.btc_amount - Bitcoin amount (must be greater than 0)
 * @param {number} deposit.date_created - Timestamp of deposit creation (must be greater than 0)
 * @returns {Object} Validation result object
 * @returns {boolean} returns.isValid - Whether the deposit passes all validation checks
 * @returns {Object|null} returns.chainConfig - Chain configuration object if valid, null otherwise
 */
const validateCommonDepositFields = (deposit) => {
  try {
    // Get chain configuration for the receiving chain
    const chainConfig = getChainConfig(deposit.receiving_chain_id);

    // Validate all required fields and their constraints
    const isValid =
      deposit.remarks === "" && // Remarks should be empty for new deposits
      deposit.minted_txn_hash === "" && // Minted txn hash should be empty for new deposits
      deposit.btc_sender_address && // BTC sender address must exist and be non-empty
      deposit.receiving_chain_id && // Receiving chain ID is required
      deposit.receiving_address && // Receiving address is required
      deposit.btc_amount > 0 && // BTC amount must be positive
      deposit.date_created > 0; // Creation timestamp must be valid

    return { isValid, chainConfig };
  } catch (error) {
    // Log error and return invalid result if chain config cannot be retrieved
    const remarks = `[validateCommonDepositFields] Chain config not found for chain ID: ${deposit.receiving_chain_id}`;
    console.log(remarks);
    return { isValid: false, chainConfig: null };
  }
};

/**
 * Updates the status of a specific deposit record in the provided array
 * This function modifies the deposit array in-place by finding the deposit
 * with the matching transaction hash and updating its status field
 * 
 * @param {Array<Object>} allDeposits - Array of deposit records to search through
 * @param {string} txnHash - Bitcoin transaction hash to identify the deposit
 * @param {string} newStatus - New status value to assign to the deposit
 * @returns {Promise<void>} Promise that resolves when the update is complete
 */
const updateOffchainDepositStatus = async (allDeposits, txnHash, newStatus) => {
  // Find the index of the deposit with matching transaction hash
  const index = allDeposits.findIndex((d) => d.btc_txn_hash === txnHash);
  
  if (index !== -1) {
    // Update the status if deposit is found
    allDeposits[index].status = newStatus;
    console.log(
      `[updateOffchainDepositStatus] Updated status for deposit ${txnHash} to ${newStatus}`,
    );
  }
  
  // Explicitly return to make async behavior intentional
  return Promise.resolve();
};

/**
 * Updates the remarks field of a specific deposit record in the provided array
 * This function modifies the deposit array in-place by finding the deposit
 * with the matching transaction hash and updating its remarks field
 * 
 * @param {Array<Object>} allDeposits - Array of deposit records to search through
 * @param {string} txnHash - Bitcoin transaction hash to identify the deposit
 * @param {string} newRemarks - New remarks to assign to the deposit
 * @returns {Promise<void>} Promise that resolves when the update is complete
 */
const updateOffchainDepositRemarks = async (
  allDeposits,
  txnHash,
  newRemarks,
) => {
  // Find the index of the deposit with matching transaction hash
  const index = allDeposits.findIndex((d) => d.btc_txn_hash === txnHash);
  
  if (index !== -1) {
    // Update the remarks if deposit is found
    allDeposits[index].remarks = newRemarks;
    console.log(
      `[updateOffchainDepositRemarks] Updated remarks for deposit ${txnHash} to ${newRemarks}`,
    );
  }
  
  // Explicitly return to make async behavior intentional
  return Promise.resolve();
};

/**
 * Updates the yield provider transaction hash of a specific deposit record
 * This function modifies the deposit array in-place by finding the deposit
 * with the matching transaction hash and updating its yield provider transaction hash
 * 
 * @param {Array<Object>} allDeposits - Array of deposit records to search through
 * @param {string} txnHash - Original Bitcoin transaction hash to identify the deposit
 * @param {string} yieldProviderTxnHash - New yield provider transaction hash to assign
 * @returns {Promise<void>} Promise that resolves when the update is complete
 */
const updateOffchainYieldProviderTxnHash = async (
  allDeposits,
  txnHash,
  yieldProviderTxnHash,
) => {
  // Find the index of the deposit with matching transaction hash
  const index = allDeposits.findIndex((d) => d.btc_txn_hash === txnHash);
  
  if (index !== -1) {
    // Update the yield provider transaction hash if deposit is found
    allDeposits[index].yield_provider_txn_hash = yieldProviderTxnHash;
    console.log(
      `[updateOffchainYieldProviderTxnHash] Updated yield provider txn hash for deposit ${txnHash} to ${yieldProviderTxnHash}`,
    );
  }
  
  // Explicitly return to make async behavior intentional
  return Promise.resolve();
};

/**
 * Fetches all deposit history from NEAR blockchain with optimized pagination and concurrency control
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
 * @param {Object} near - NEAR blockchain instance with getAllDeposits and getTotalDepositsCount methods
 * @param {number} [limit=1000] - Number of records to fetch per batch (default: 1000)
 * @param {number} [concurrentLimit=5] - Maximum number of concurrent batch requests (default: 5)
 * @returns {Promise<Array<Object>>} Promise that resolves to an array of all deposit records
 * @returns {Promise<Array>} Returns empty array if no deposits found or on error
 */
const getAllDepositHistory = async (
  near,
  limit = 1000,
  concurrentLimit = 5,
) => {
  // Prevent concurrent executions to avoid data inconsistency
  if (flagsBatch.GetAllDepositHistoryRunning) {
    console.log(
      "[getAllDepositHistory] GetAllDepositHistoryRunning is running",
    );
    return;
  }

  // Set global flag to prevent concurrent executions
  flagsBatch.GetAllDepositHistoryRunning = true;

  try {
    // Fetch first batch to check if deposits exist and get initial data
    const firstBatch = await near.getAllDeposits(0, limit);

    // Return early if no deposits found
    if (firstBatch.length === 0) {
      console.log("[getAllDepositHistory] No deposits found");
      return [];
    }

    // Initialize result array with first batch
    let allDeposits = [...firstBatch];

    // Get total count to calculate required number of batches
    const totalCount = await near.getTotalDepositsCount();
    const totalBatches = Math.ceil(totalCount / limit);

    // Process remaining batches in chunks to limit concurrent requests
    for (let i = 1; i < totalBatches; i += concurrentLimit) {
      const batchPromises = [];
      const end = Math.min(i + concurrentLimit, totalBatches);

      // Create promises for current chunk of batches
      for (let j = i; j < end; j++) {
        const currentOffset = j * limit;
        batchPromises.push(near.getAllDeposits(currentOffset, limit));
      }

      // Execute current chunk of batches in parallel
      const batchResults = await Promise.all(batchPromises);

      // Combine results from current chunk into main array
      batchResults.forEach((batch) => {
        allDeposits = allDeposits.concat(batch);
      });

      // Add small delay between chunks to prevent API overload
      if (i + concurrentLimit < totalBatches) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Log final result count
    console.log(
      "[getAllDepositHistory] Total deposits fetched:",
      allDeposits.length,
    );

    return allDeposits;
  } catch (error) {
    // Log error and return empty array on failure
    console.error(`[getAllDepositHistory] Failed: ${error.message}`);
    return [];
  } finally {
    // Always reset the global flag, even if an error occurred
    flagsBatch.GetAllDepositHistoryRunning = false;
  }
};

/**
 * Filters deposit records to find those that are ready for minting
 * This function applies validation and status checks to identify deposits
 * that have been successfully deposited to the yield provider and are
 * ready for the minting process
 * 
 * @param {Array<Object>} allDeposits - Array of all deposit records to filter
 * @returns {Promise<Array<Object>>} Promise that resolves to array of deposits ready for minting
 */
const getDepositsToBeMinted = async (allDeposits) => {
  // Get deposit status constants
  const { DEPOSIT_STATUS } = getConstants();

  // Filter deposits based on validation and status criteria
  const depositsToBeMinted = allDeposits.filter((deposit) => {
    // Validate common deposit fields
    const { isValid } = validateCommonDepositFields(deposit);

    // Return true if deposit is valid and has the correct status for minting
    return (
      isValid && deposit.status === DEPOSIT_STATUS.BTC_YIELD_PROVIDER_DEPOSITED
    );
  });
  
  // Explicitly return the filtered deposits as a Promise
  return Promise.resolve(depositsToBeMinted);
};

// Export all helper functions for use in other modules
module.exports = {
  getAllDepositHistory,
  updateOffchainDepositStatus,
  updateOffchainDepositRemarks,
  updateOffchainYieldProviderTxnHash,
  getDepositsToBeMinted,
};
