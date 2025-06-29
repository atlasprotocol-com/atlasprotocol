const { getConstants } = require("../constants");
const bridgingHelper = require("../helpers/bridgingHelper");

const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasBtcBridgingYieldProviderWithdrawn(
  allBridgings,
  near,
  bithiveRecords
) {
  const batchName = `Batch J UpdateAtlasBtcBridgingYieldProviderWithdrawn`;

  const { BRIDGING_STATUS, BITHIVE_STATUS } = getConstants(); // Access constants dynamically

  // Skip if the batch is already running
  if (flagsBatch.UpdateAtlasBtcBridgingYieldProviderWithdrawnRunning) return;

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcBridgingYieldProviderWithdrawnRunning = true;

    const filteredTxns = await bridgingHelper.getPendingBridgingFeesWithdrawing(allBridgings);

    for (let j = 0; j < filteredTxns.length; j++) {
      const txn = filteredTxns[j];
      try {
        //console.log(`\nProcessing ${j} of ${filteredTxns.length} txns...`);
        
        const bithiveRecord = bithiveRecords.find((record) => record.withdrawTxHash === txn.yield_provider_txn_hash);

        if (!bithiveRecord) {
          console.log(`Bithive record not found for txn hash ${txn.yield_provider_txn_hash}`);
          continue;
        }

        if (
          [
            BITHIVE_STATUS.WITHDRAW_CONFIRMED,
            BITHIVE_STATUS.DEPOSIT_CONFIRMED,
            BITHIVE_STATUS.DEPOSIT_CONFIRMED_INVALID
          ].includes(
            bithiveRecord.status,
          )
        ) {
          await near.updateBridgingFeesYieldProviderWithdrawn(
            txn.txn_hash,
          );
          await bridgingHelper.updateOffchainBridgingYieldProviderStatus( 
            allBridgings,
            txn.txn_hash,
            BRIDGING_STATUS.ABTC_YIELD_PROVIDER_WITHDRAWN,
          );
          console.log(
            `[UpdateAtlasBtcBridgingYieldProviderWithdrawn] Processed record ${j}: Updated Bridging yield provider withdrawn for txn hash ${txn.txn_hash}`
          );
        }
      } catch (error) {
        
        const errorMessage = error.body && error.body.error_message 
            ? error.body.error_message 
            : error.toString();

        console.error(
          `[UpdateAtlasBtcBridgingYieldProviderWithdrawn] Error processing record ${j} for txn hash ${txn.txn_hash}: `,
          errorMessage,
        );
        await near.updateBridgingFeesYieldProviderRemarks(
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
    flagsBatch.UpdateAtlasBtcBridgingYieldProviderWithdrawnRunning = false;
  }
}

module.exports = { UpdateAtlasBtcBridgingYieldProviderWithdrawn };
