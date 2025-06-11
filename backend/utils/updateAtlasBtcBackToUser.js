const { getConstants } = require("../constants");
const { getRedemptionsToBeProcessedToRedeemed, updateOffchainRedemptionStatus } = require("../helpers/redemptionHelper");

const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasBtcBackToUser(allRedemptions, near, bitcoinInstance) {
  const batchName = `Batch J UpdateAtlasBtcBackToUser`;

  const { REDEMPTION_STATUS } = getConstants(); // Access constants dynamically

  const BTC_MIN_CONFIRMATIONS = Number(process.env.BTC_MIN_CONFIRMATIONS || 12);

  // Skip if the batch is already running
  if (flagsBatch.UpdateAtlasBtcBackToUserRunning) return;

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcBackToUserRunning = true;

    // Filter redemptions using the helper function
    const filteredTxns = getRedemptionsToBeProcessedToRedeemed(allRedemptions);

    for (const txn of filteredTxns) {
      try {
        const btcTxn = await bitcoinInstance.fetchTxnByTxnID(
          txn.btc_txn_hash,
        );
        
        const confirmations = await bitcoinInstance.getConfirmations(btcTxn.status.block_height);
        
        const ok = confirmations >= BTC_MIN_CONFIRMATIONS;

        if (ok) {
            await near.updateRedemptionRedeemed(txn.txn_hash);
            updateOffchainRedemptionStatus(allRedemptions, txn.txn_hash, REDEMPTION_STATUS.BTC_REDEEMED_BACK_TO_USER);
            console.log(
              `Processed record: Updated Redemption for txn hash ${txn.txn_hash} and BTC txn hash ${txn.btc_txn_hash}`,
            );
        }
      } catch (error) {
        const errorMessage =
          error.body && error.body.error_message
            ? error.body.error_message
            : error.toString();

        console.error(
          `Error processing record for txn hash ${txn.txn_hash}: `,
          errorMessage,
        );
        await near.updateRedemptionRemarks(
          txn.txn_hash,
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
