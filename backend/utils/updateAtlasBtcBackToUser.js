const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasBtcBackToUser(
  allRedemptions,
  near,
  bitcoinInstance,
) {
  const batchName = `Batch J UpdateAtlasBtcBackToUser`;

  const { REDEMPTION_STATUS } = getConstants(); // Access constants dynamically

  // Skip if the batch is already running
  if (flagsBatch.UpdateAtlasBtcBackToUserRunning) return;

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcBackToUserRunning = true;

    // Filter redemptions where status = BTC_PENDING_MEMPOOL_CONFIRMATION or BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER
    const filteredTxns = allRedemptions.filter(
      (redemption) =>
        redemption.abtc_redemption_address !== "" &&
        redemption.abtc_redemption_chain_id !== "" &&
        redemption.btc_receiving_address !== "" &&
        redemption.status === REDEMPTION_STATUS.BTC_PENDING_MEMPOOL_CONFIRMATION &&
        redemption.remarks === "" &&
        redemption.yield_provider_txn_hash !== "" &&
        redemption.yield_provider_gas_fee !== 0
    );

    let i = 0;

    filteredTxns.forEach(async (txn) => {
      try {
        i++;
        console.log(`\nProcessing ${i} of ${filteredTxns.length} txns...`);

        const btcTxn = await bitcoinInstance.fetchTxnByTxnID(txn.btc_txn_hash);
        
        if (btcTxn && btcTxn.status && btcTxn.status.confirmed) {
          // const confirmations = btcTxn.status.block_height 
          //   ? await bitcoinInstance.getConfirmations(btcTxn.status.block_height) 
          //   : 0;
          
          //   //console.log(`Confirmations: ${confirmations}`);
            
          //   if (confirmations > 6) {
            await near.updateRedemptionRedeemed(
              txn.txn_hash,
            );
            console.log(
              `Processed record ${i}: Updated Redemption for txn hash ${txn.txn_hash} and BTC txn hash ${txn.btc_txn_hash}`
            );
          // }
        }
        
      }  catch (error) {
        
        const errorMessage = error.body && error.body.error_message 
            ? error.body.error_message 
            : error.toString();

        console.error(
          `Error processing record ${i} for txn hash ${txn.txn_hash}: `,
          errorMessage,
        );
        await near.updateRedemptionRemarks(
          txn.txn_hash,
          `Error processing txn: ${errorMessage}`,
        );

        // Skip to the next iteration if an error occurs
        return;
      }
    });

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasBtcBackToUserRunning = false;
  }
}

module.exports = { UpdateAtlasBtcBackToUser };
