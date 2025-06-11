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

    // Filter valid redemptions that are in withdrawing state
    // Must have valid addresses, non-empty yield provider txn hash, and gas fee
    // const filteredTxns = allRedemptions.filter(
    //   (redemption) =>
    //     redemption.abtc_redemption_address !== "" &&
    //     redemption.abtc_redemption_chain_id !== "" &&
    //     redemption.btc_receiving_address !== "" &&
    //     redemption.status ===
    //       REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWING &&
    //     redemption.remarks === "" &&
    //     redemption.yield_provider_txn_hash === lastWithdrawalData.lastWithdrawalTxHash &&
    //     redemption.yield_provider_gas_fee !== 0,
    // );

    const filteredTxns = redemptionHelper.getWithdrawingFromYieldProvider(allRedemptions);
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

      redemptionHelper.updateOffchainRedemptionStatus(allRedemptions, redemption.txn_hash, REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWN);

      // Update status in allRedemptions array
      // const redemptionToUpdate = allRedemptions.find(r => r.txn_hash === redemption.txn_hash);
      // if (redemptionToUpdate) {
      //   redemptionToUpdate.status = REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWN;
      // }
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
