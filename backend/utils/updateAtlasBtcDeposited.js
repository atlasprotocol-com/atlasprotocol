const { getConstants } = require("../constants");
const { updateOffchainDepositStatus, updateOffchainDepositRemarks } = require("../helpers/depositsHelper");

const { flagsBatch } = require("./batchFlags");

const BTC_MIN_CONFIRMATIONS = Number(process.env.BTC_MIN_CONFIRMATIONS || 12);

// Helper function to sleep for specified milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function UpdateAtlasBtcDeposited(depositRecords, near, bitcoinInstance) {
  const batchName = `Batch B UpdateAtlasBtcDeposited`;
  console.log(batchName);

  if (flagsBatch.UpdateAtlasBtcDepositedRunning) {
    return;
  }

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcDepositedRunning = true;

    const { DEPOSIT_STATUS } = getConstants();
    const currentBlockHeight = await bitcoinInstance.getCurrentBlockHeight();

    const filteredRecords = depositRecords.filter(
      (record) =>
        record.status === DEPOSIT_STATUS.BTC_PENDING_DEPOSIT_MEMPOOL &&
        !record.remarks,
    );

    let processedCount = 0;
    const PAUSE_INTERVAL = 10;
    const PAUSE_DURATION = 60000; // 1 minute in milliseconds

    for (const record of filteredRecords) {
      const btcTxnHash = record.btc_txn_hash;
      let timestamp = 0;

      try {
        // Get transaction details from mempool
        const txn = await bitcoinInstance.fetchRawTransaction(btcTxnHash);

        if (txn && txn.status.block_height && txn.status.confirmed) {
          const ok =
            currentBlockHeight - txn.status.block_height + 1 >=
            BTC_MIN_CONFIRMATIONS;
          if (ok) {
            console.log("btcTxnHash confirmed:", btcTxnHash);
            timestamp = txn.status.block_time;

            // Update existing record
            await near.updateDepositBtcDeposited(btcTxnHash, timestamp);
            updateOffchainDepositStatus(depositRecords, btcTxnHash, DEPOSIT_STATUS.BTC_DEPOSITED_INTO_ATLAS);

            console.log(`[${batchName}] Updated Deposit with BTC txn hash ${btcTxnHash}`);
          }
        }
      } catch (error) {
        console.log("error.response.data:", error.response.data);

        await near.updateDepositRemarks(btcTxnHash, error.response.data);
        updateOffchainDepositRemarks(depositRecords, btcTxnHash, error.response.data);

        continue;
      }

      processedCount++;
      
      // Pause every 100 records
      if (processedCount % PAUSE_INTERVAL === 0) {
        console.log(`[${batchName}] Processed ${processedCount} records. Pausing for 1 minute...`);
        await sleep(PAUSE_DURATION);
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasBtcDepositedRunning = false;
  }
}

module.exports = { UpdateAtlasBtcDeposited };
