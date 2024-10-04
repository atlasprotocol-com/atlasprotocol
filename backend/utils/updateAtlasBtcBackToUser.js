const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");
const { handleCoboTransaction } = require('./coboIntegration');

// BATCH I: Retrieve redemption records, find corresponding record in BTC mempool and updates NEAR redemption.status, timestamp, and btc_txn_hash based on OP_RETURN
async function UpdateAtlasBtcBackToUser(
  redemptions,
  btcMempool,
  btcAtlasDepositAddress,
  near,
  bitcoin,
) {
  const batchName = `Batch I UpdateAtlasBtcBackToUser`;
  const { REDEMPTION_STATUS } = getConstants(); // Access constants dynamically

  // Skip if the batch is already running
  if (flagsBatch.UpdateAtlasBtcBackToUserRunning) return;

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcBackToUserRunning = true;

    // Filter redemptions where status = BTC_PENDING_MEMPOOL_CONFIRMATION or BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER
    const filteredTxns = redemptions.filter(
      (redemption) =>
        redemption.abtc_redemption_address !== "" &&
        redemption.abtc_redemption_chain_id !== "" &&
        redemption.btc_receiving_address !== "" &&
        (redemption.status === REDEMPTION_STATUS.BTC_PENDING_MEMPOOL_CONFIRMATION ||
          (redemption.status === REDEMPTION_STATUS.BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER &&
            redemption.btc_txn_hash === "")) &&
        redemption.remarks === "",
    );

    for (let i = 0; i < filteredTxns.length; i++) {
      const txn = filteredTxns[i];
      const redemptionTxnHash = txn.txn_hash;
      let btcTxnHash, timestamp, hasConfirmed;

      try {
        console.log(`\nProcessing ${i + 1} of ${filteredTxns.length} txns...`);

        if (process.env.USE_COBO === 'true') {
          const custodyTxnId = txn.custody_txn_id;
          // Example COBO logic placeholder, populate this block
          ({ btcTxnHash, timestamp, hasConfirmed } = await handleCoboTransaction(custodyTxnId));
        } else {
          ({ btcTxnHash, timestamp, hasConfirmed } =
            await bitcoin.getTxnHashAndTimestampFromOpReturnCode(
              btcMempool,
              btcAtlasDepositAddress,
              txn.timestamp,
              redemptionTxnHash,
            ));
        }


        // If BTC mempool transaction found, update the redemption record
        if (btcTxnHash) {
          if (!hasConfirmed &&
            txn.status === REDEMPTION_STATUS.BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER) {
            await near.updateRedemptionPendingBtcMempool(
              redemptionTxnHash,
              btcTxnHash,
            );
          }

          if (hasConfirmed) {
            await near.updateRedemptionRedeemed(
              redemptionTxnHash,
              btcTxnHash,
              timestamp,
            );
          }

          console.log(
            `Processed record ${i + 1}: Updated Redemption for txn hash ${redemptionTxnHash} and BTC txn hash ${btcTxnHash}`
          );
        }
      } catch (error) {
        
        const errorMessage = error.body && error.body.error_message 
            ? error.body.error_message 
            : error.toString();

        console.error(
          `Error processing record ${i + 1} for txn hash ${redemptionTxnHash}: `,
          errorMessage,
        );
        await near.updateRedemptionRemarks(
          redemptionTxnHash,
          `Error processing txn: ${errorMessage}`,
        );

        // Skip to the next iteration if an error occurs
        continue;
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasBtcBackToUserRunning = false;
  }
}

module.exports = { UpdateAtlasBtcBackToUser };
