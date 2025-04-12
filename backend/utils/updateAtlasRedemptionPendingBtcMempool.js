const WithdrawalFromYieldProviderHelper = require("../helpers/withdrawalFromYieldProviderHelper");
const { getConstants } = require("../constants")

const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasRedemptionPendingBtcMempool(near, redemptions) {
  const batchName = `Batch J UpdateAtlasRedemptionPendingBtcMempool`;

  // Check if a previous batch is still running
  if (flagsBatch.UpdateAtlasRedemptionPendingBtcMempoolRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run...`);
    flagsBatch.UpdateAtlasRedemptionPendingBtcMempoolRunning = true;

    const { REDEMPTION_STATUS } = getConstants();
    // Get the last withdrawal data to check if we have a BTC transaction hash
    const { sendToUserBtcTxnHash } = await WithdrawalFromYieldProviderHelper.getLastWithdrawalData();
    
    if (!sendToUserBtcTxnHash) {
      console.log("[UpdateAtlasRedemptionPendingBtcMempool] No BTC transaction hash found. Skipping this run.");
      return;
    }

    // Read the records file
    const records = await WithdrawalFromYieldProviderHelper.readRecordsFromFile();
    
    if (!records || records.length === 0) {
      console.log("[UpdateAtlasRedemptionPendingBtcMempool] No records to process. Clearing BTC transaction hash.");
      // Clear the BTC transaction hash since we've processed all records
      await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData({
        sendToUserBtcTxnHash: ''
      });
      return;
    }

    console.log(`[UpdateAtlasRedemptionPendingBtcMempool] Processing ${records.length} records`);

    // Process each record
    for (const record of records) {
      try {
        // Validate record format
        if (!record.txn_hash || !record.btc_receiving_address || !record.amount) {
          console.error(`[UpdateAtlasRedemptionPendingBtcMempool] Invalid record format:`, record);
          continue;
        }

        console.log(`[UpdateAtlasRedemptionPendingBtcMempool] Processing record:`, {
          txnHash: record.txn_hash,
          btcAddress: record.btc_receiving_address,
          amount: record.amount
        });
        
        await near.updateRedemptionPendingBtcMempool(record.txn_hash, sendToUserBtcTxnHash);
        
        // Update redemption record with BTC transaction hash and status
        const redemption = redemptions.find(r => r.txn_hash === record.txn_hash);
        if (redemption) {
          redemption.btc_txn_hash = sendToUserBtcTxnHash;
          redemption.status = REDEMPTION_STATUS.BTC_PENDING_MEMPOOL_CONFIRMATION;
          console.log(`[UpdateAtlasRedemptionPendingBtcMempool] Updated redemption ${record.txn_hash} with BTC txn hash ${sendToUserBtcTxnHash}`);
        } else {
          console.warn(`[UpdateAtlasRedemptionPendingBtcMempool] No redemption found for txn hash: ${record.txn_hash}`);
        }
        
        // Remove the processed record from the file
        await WithdrawalFromYieldProviderHelper.removeRecordFromFile(record.txn_hash);
        console.log(`[UpdateAtlasRedemptionPendingBtcMempool] Removed record for txn hash: ${record.txn_hash}`);
      } catch (error) {
        console.error(
          "[UpdateAtlasRedemptionPendingBtcMempool] Error processing record:",
          error.message,
          "\nRecord:", record
        );
      }
    }

    // Check if all records were processed
    const remainingRecords = await WithdrawalFromYieldProviderHelper.readRecordsFromFile();
    if (remainingRecords.length === 0) {
      console.log("[UpdateAtlasRedemptionPendingBtcMempool] All records processed successfully. Clearing BTC transaction hash.");
      await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData({
        sendToUserBtcTxnHash: ''
      });
    } else {
      console.log(`[UpdateAtlasRedemptionPendingBtcMempool] ${remainingRecords.length} records remaining to be processed.`);
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error in ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasRedemptionPendingBtcMempoolRunning = false;
  }
}

module.exports = { UpdateAtlasRedemptionPendingBtcMempool }; 