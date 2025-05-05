const { flagsBatch } = require("../utils/batchFlags");

/**
 * Fetches all redemption history from NEAR with pagination and concurrent request limiting
 * @param {Object} near - NEAR instance
 * @param {number} limit - Number of records per batch
 * @param {number} concurrentLimit - Maximum number of concurrent requests
 * @returns {Promise<Array>} Array of redemption records
 */
const getAllRedemptionHistory = async (near, limit = 100, concurrentLimit = 10) => {
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

module.exports = {
  getAllRedemptionHistory,
  updateOffchainRedemptionStatus,
  updateOffchainRedemptionRemarks,
}; 