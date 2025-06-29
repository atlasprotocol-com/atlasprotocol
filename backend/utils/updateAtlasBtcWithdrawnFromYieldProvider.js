const { getConstants } = require("../constants");
const redemptionHelper = require("../helpers/redemptionHelper");

const { flagsBatch } = require("./batchFlags");

/**
 * Updates the status of BTC redemptions that have been withdrawn from yield provider
 * @param {Array} allRedemptions - Array of all redemption records
 * @param {Object} near - Near protocol instance for making contract calls
 * @param {Object} allBridgings - Array of all bridging records
 */
async function UpdateAtlasBtcWithdrawnFromYieldProvider(
  allRedemptions,
  near,
  bithiveRecords,
) {
  const batchName = `Batch H UpdateAtlasBtcWithdrawnFromYieldProvider`;
  
  // Get status constants
  const { REDEMPTION_STATUS, BITHIVE_STATUS } = getConstants();

  // Prevent concurrent batch runs
  if (flagsBatch.UpdateAtlasBtcWithdrawnFromYieldProviderRunning) return;

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcWithdrawnFromYieldProviderRunning = true;

    const filteredTxns = await redemptionHelper.getWithdrawingFromYieldProvider(allRedemptions);
    console.log(`[UpdateAtlasBtcWithdrawnFromYieldProvider] Found ${filteredTxns.length} redemptions to update`);
    for (const redemption of filteredTxns) {
      const withdrawal = bithiveRecords.find(
        record => record.withdrawTxHash === redemption.yield_provider_txn_hash
      );
  
      if (!withdrawal) {
        console.log("[UpdateAtlasBtcWithdrawnFromYieldProvider] No bithive record found for yield provider txn hash", redemption.yield_provider_txn_hash);
        return;
      }
  
      if (![
        BITHIVE_STATUS.WITHDRAW_CONFIRMED,
        BITHIVE_STATUS.DEPOSIT_CONFIRMED,
        BITHIVE_STATUS.DEPOSIT_CONFIRMED_INVALID
      ].includes(withdrawal.status)) {
        console.log("[UpdateAtlasBtcWithdrawnFromYieldProvider] Withdrawal status not confirmed yet:", withdrawal.status);
        return;
      }

      await near.updateRedemptionWithdrawnFromYieldProvider(
        redemption.txn_hash,
      );

      await redemptionHelper.updateOffchainRedemptionStatus(allRedemptions, redemption.txn_hash, REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWN);

    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    // Reset running flag regardless of success/failure
    flagsBatch.UpdateAtlasBtcWithdrawnFromYieldProviderRunning = false;
  }
}

module.exports = { UpdateAtlasBtcWithdrawnFromYieldProvider };
