const { getDepositsToBeTimedOut, updateOffchainDepositRemarks } = require("../helpers/depositsHelper");

const { flagsBatch } = require("./batchFlags");

// Helper function to sleep for specified milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function UpdateAtlasBtcTimeout(depositRecords, near) {
  const batchName = `Batch L UpdateAtlasBtcTimeout`;
  console.log(batchName);

  if (flagsBatch.UpdateAtlasBtcTimeoutRunning) {
    return;
  }

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcTimeoutRunning = true;

    // Get deposits that should be marked as timed out
    const depositsToTimeout = await getDepositsToBeTimedOut(depositRecords);

    if (depositsToTimeout.length === 0) {
      console.log(`${batchName}. No deposits to timeout.`);
      return;
    }

    let processedCount = 0;
    const PAUSE_INTERVAL = 10;
    const PAUSE_DURATION = 60000; // 1 minute in milliseconds

    for (const deposit of depositsToTimeout) {
      const btcTxnHash = deposit.btc_txn_hash;

      try {
        // Call the NEAR contract function to mark deposit as timed out
        await near.setDepositTimeout(btcTxnHash);
        
        console.log(`[${batchName}] Marked deposit as timed out: ${btcTxnHash}`);
      } catch (error) {
        console.error(`[${batchName}] Error processing timeout for ${btcTxnHash}:`, error);
         
        continue;
      }

      processedCount++;
      
      // Pause every PAUSE_INTERVAL records
      if (processedCount % PAUSE_INTERVAL === 0) {
        console.log(`[${batchName}] Processed ${processedCount} records. Pausing for 1 minute...`);
        await sleep(PAUSE_DURATION);
      }
    }

    console.log(`${batchName} completed successfully. Processed ${processedCount} deposits.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasBtcTimeoutRunning = false;
  }
}

module.exports = { UpdateAtlasBtcTimeout }; 