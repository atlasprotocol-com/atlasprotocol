const { flagsBatch } = require("../utils/batchFlags");

/**
 * Updates the status of a deposit record in the array
 * @param {Array} allDeposits - Array of deposit records
 * @param {string} txnHash - Transaction hash to update
 * @param {string} newStatus - New status to set
 */
const updateOffchainDepositStatus = async (allDeposits, txnHash, newStatus) => {
  const index = allDeposits.findIndex(d => d.btc_txn_hash === txnHash);
  if (index !== -1) {
    allDeposits[index].status = newStatus;
    console.log(`[updateOffchainDepositStatus] Updated status for deposit ${txnHash} to ${newStatus}`);
  }
};

/**
 * Updates the remarks of a deposit record in the array
 * @param {Array} allDeposits - Array of deposit records
 * @param {string} txnHash - Transaction hash to update
 * @param {string} newRemarks - New remarks to set
 */
const updateOffchainDepositRemarks = async (allDeposits, txnHash, newRemarks) => {
  const index = allDeposits.findIndex(d => d.btc_txn_hash === txnHash);
  if (index !== -1) {
    allDeposits[index].remarks = newRemarks;
    console.log(`[updateOffchainDepositRemarks] Updated remarks for deposit ${txnHash} to ${newRemarks}`);
  }
};

/**
 * Updates the yield provider transaction hash of a deposit record in the array
 * @param {Array} allDeposits - Array of deposit records
 * @param {string} txnHash - Original transaction hash to identify the deposit
 * @param {string} yieldProviderTxnHash - New yield provider transaction hash to set
 */
const updateOffchainYieldProviderTxnHash = async (allDeposits, txnHash, yieldProviderTxnHash) => {
  const index = allDeposits.findIndex(d => d.btc_txn_hash === txnHash);
  if (index !== -1) {
    allDeposits[index].yield_provider_txn_hash = yieldProviderTxnHash;
    console.log(`[updateOffchainYieldProviderTxnHash] Updated yield provider txn hash for deposit ${txnHash} to ${yieldProviderTxnHash}`);
  }
};

/**
 * Fetches all deposit history from NEAR with pagination and concurrent request limiting
 * @param {Object} near - NEAR instance
 * @param {number} limit - Number of records per batch
 * @param {number} concurrentLimit - Maximum number of concurrent requests
 * @returns {Promise<Array>} Array of deposit records
 */
const getAllDepositHistory = async (near, limit = 1000, concurrentLimit = 5) => {
  if (flagsBatch.GetAllDepositHistoryRunning) {
    console.log(
      "[getAllDepositHistory] GetAllDepositHistoryRunning is running",
    );
    return;
  }

  flagsBatch.GetAllDepositHistoryRunning = true;

  try {
    // First, get the first batch to check if there are any deposits
    const firstBatch = await near.getAllDeposits(0, limit);

    if (firstBatch.length === 0) {
      console.log("[getAllDepositHistory] No deposits found");
      return [];
    }

    let allDeposits = [...firstBatch];

    // Get total count from NEAR to calculate number of batches needed
    const totalCount = await near.getTotalDepositsCount();
    const totalBatches = Math.ceil(totalCount / limit);

    // Process batches in chunks to limit concurrent requests
    for (let i = 1; i < totalBatches; i += concurrentLimit) {
      const batchPromises = [];
      const end = Math.min(i + concurrentLimit, totalBatches);

      for (let j = i; j < end; j++) {
        const currentOffset = j * limit;
        batchPromises.push(near.getAllDeposits(currentOffset, limit));
      }

      // Fetch current chunk of batches in parallel
      const batchResults = await Promise.all(batchPromises);

      // Combine results from current chunk
      batchResults.forEach((batch) => {
        allDeposits = allDeposits.concat(batch);
      });

      // Optional: Add small delay between chunks to prevent overloading
      if (i + concurrentLimit < totalBatches) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      "[getAllDepositHistory] Total deposits fetched:",
      allDeposits.length,
    );

    return allDeposits;
  } catch (error) {
    console.error(`[getAllDepositHistory] Failed: ${error.message}`);
    return [];
  } finally {
    flagsBatch.GetAllDepositHistoryRunning = false;
  }
};

module.exports = {
  getAllDepositHistory,
  updateOffchainDepositStatus,
  updateOffchainDepositRemarks,
  updateOffchainYieldProviderTxnHash,
}; 