const { flagsBatch } = require("../utils/batchFlags");
const { getChainConfig } = require("../utils/network.chain.config");
const { getConstants } = require("../constants");

/**
 * Validates common redemption record fields
 * @param {Object} redemption - Redemption record to validate
 * @returns {Object} Object containing validation result and chain config if valid
 */
const validateCommonRedemptionFields = (redemption) => {
  try {
    const chainConfig = getChainConfig(redemption.abtc_redemption_chain_id);

    const isValid =
      redemption.remarks === "" &&
      redemption.verified_count >= chainConfig.validators_threshold;

    return { isValid, chainConfig };
  } catch (error) {
    const remarks = `[validateCommonRedemptionFields] Chain config not found for chain ID: ${redemption.abtc_redemption_chain_id}`;
    console.log(remarks);
    return { isValid: false, chainConfig: null };
  }
};

/**
 * Fetches all redemption history from NEAR with pagination and concurrent request limiting
 * @param {Object} near - NEAR instance
 * @param {number} limit - Number of records per batch
 * @param {number} concurrentLimit - Maximum number of concurrent requests
 * @returns {Promise<Array>} Array of redemption records
 */
const getAllRedemptionHistory = async (near, limit = 1000, concurrentLimit = 5) => {
  if (flagsBatch.GetAllRedemptionHistoryRunning) {
    console.log(
      "[getAllRedemptionHistory] GetAllRedemptionHistoryRunning is running",
    );
    return;
  }

  flagsBatch.GetAllRedemptionHistoryRunning = true;

  try {
    // First, get the first batch to check if there are any redemptions
    const firstBatch = await near.getAllRedemptions(0, limit);

    if (firstBatch.length === 0) {
      console.log("[getAllRedemptionHistory] No redemptions found");
      return [];
    }

    let allRedemptions = [...firstBatch];

    // Get total count from NEAR to calculate number of batches needed
    const totalCount = await near.getTotalRedemptionsCount();
    const totalBatches = Math.ceil(totalCount / limit);

    // Process batches in chunks to limit concurrent requests
    for (let i = 1; i < totalBatches; i += concurrentLimit) {
      const batchPromises = [];
      const end = Math.min(i + concurrentLimit, totalBatches);

      for (let j = i; j < end; j++) {
        const currentOffset = j * limit;
        batchPromises.push(near.getAllRedemptions(currentOffset, limit));
      }

      // Fetch current chunk of batches in parallel
      const batchResults = await Promise.all(batchPromises);

      // Combine results from current chunk
      batchResults.forEach((batch) => {
        allRedemptions = allRedemptions.concat(batch);
      });

      // Optional: Add small delay between chunks to prevent overloading
      if (i + concurrentLimit < totalBatches) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      "[getAllRedemptionHistory] Total redemptions fetched:",
      allRedemptions.length,
    );

    return allRedemptions;
  } catch (error) {
    console.error(`[getAllRedemptionHistory] Failed: ${error.message}`);
    return [];
  } finally {
    flagsBatch.GetAllRedemptionHistoryRunning = false;
  }
};

/**
 * Updates the status of a redemption record in the array
 * @param {Array} allRedemptions - Array of redemption records
 * @param {string} txnHash - Transaction hash to update
 * @param {string} newStatus - New status to set
 */
const updateOffchainRedemptionStatus = (allRedemptions, txnHash, newStatus) => {
  const index = allRedemptions.findIndex(r => r.txn_hash === txnHash);
  if (index !== -1) {
    allRedemptions[index].status = newStatus;
    console.log(`[updateOffchainRedemptionStatus] Updated status for redemption ${txnHash} to ${newStatus}`);
  }
};

/**
 * Updates the remarks of a redemption record in the array
 * @param {Array} allRedemptions - Array of redemption records
 * @param {string} txnHash - Transaction hash to update
 * @param {string} newRemarks - New remarks to set
 */
const updateOffchainRedemptionRemarks = (allRedemptions, txnHash, newRemarks) => {
  const index = allRedemptions.findIndex(r => r.txn_hash === txnHash);
  if (index !== -1) {
    allRedemptions[index].remarks = newRemarks;
    console.log(`[updateOffchainRedemptionRemarks] Updated remarks for redemption ${txnHash} to ${newRemarks}`);
  }
};

const getPendingRedemptionsForWithdrawal = (allRedemptions) => {
  const { REDEMPTION_STATUS } = getConstants();
  
  return allRedemptions.filter(redemption => {
    const { isValid } = validateCommonRedemptionFields(redemption);

    return isValid && 
      redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING && 
      redemption.yield_provider_txn_hash === "";
  });
};

const getWithdrawingFromYieldProvider = (allRedemptions) => {
  const { REDEMPTION_STATUS } = getConstants();

  return allRedemptions.filter(redemption => {
    const { isValid } = validateCommonRedemptionFields(redemption);

    return isValid && 
      redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWING && 
      redemption.yield_provider_txn_hash !== "" && 
      redemption.yield_provider_gas_fee !== 0;  
  });
};

/**
 * Get redemptions that are pending unstaking from yield provider
 * @param {Array} redemptions - Array of redemption records
 * @returns {Array} Array of redemptions eligible for unstaking
 */
async function getPendingRedemptionsForUnstake(redemptions) {
  const { REDEMPTION_STATUS } = getConstants();

  try {
    // Filter redemptions that are in ABTC_BURNT status and have no remarks
    const pendingRedemptions = redemptions.filter(redemption => {
      try {
        // Use the common validation helper
        const { isValid } = validateCommonRedemptionFields(redemption);
        
        // Additional criteria specific to unstaking:
        // 1. Status is ABTC_BURNT
        // 2. Amount is greater than minimum threshold
        return (
          isValid &&
          redemption.status === REDEMPTION_STATUS.ABTC_BURNT &&
          redemption.yield_provider_txn_hash === ""
        );
      } catch (error) {
        console.error(`[getPendingRedemptionsForUnstake] Error processing redemption ${redemption.txn_hash}:`, error);
        return false;
      }
    });

    return pendingRedemptions;
  } catch (error) {
    console.error("[getPendingRedemptionsForUnstake] Error:", error);
    return [];
  }
}

const getWithdrawRedemptions = (allRedemptions) => {
  const { REDEMPTION_STATUS } = getConstants();

  return allRedemptions.filter(redemption => {
    const { isValid } = validateCommonRedemptionFields(redemption);

    return isValid && 
      redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWN && 
      redemption.yield_provider_txn_hash !== "" && 
      redemption.yield_provider_gas_fee > 0;  
  });
};

/**
 * Filters redemptions that are ready for processing
 * @param {Array} allRedemptions - Array of redemption records
 * @returns {Array} Filtered redemptions ready for processing
 */
const getRedemptionsToBeProcessedToRedeemed = (allRedemptions) => {
  const { REDEMPTION_STATUS } = getConstants();
  
  const filteredTxns = allRedemptions.filter((redemption) => {
    try {
      const { isValid, chainConfig } = validateCommonRedemptionFields(redemption);

      return isValid &&
        redemption.status === REDEMPTION_STATUS.BTC_PENDING_MEMPOOL_CONFIRMATION &&
        redemption.yield_provider_txn_hash !== "" &&
        redemption.yield_provider_gas_fee !== 0 &&
        redemption.btc_txn_hash_verified_count >= chainConfig.validators_threshold;
    } catch (error) {
      const remarks = `Chain config not found for chain ID: ${redemption.abtc_redemption_chain_id}`;
      console.log(remarks);
      return false;
    }
  });
  
  return filteredTxns;
};

module.exports = {
  getAllRedemptionHistory,
  updateOffchainRedemptionStatus,
  updateOffchainRedemptionRemarks,
  getPendingRedemptionsForWithdrawal,
  getPendingRedemptionsForUnstake,
  getWithdrawingFromYieldProvider,
  getWithdrawRedemptions,
  getRedemptionsToBeProcessedToRedeemed
};  