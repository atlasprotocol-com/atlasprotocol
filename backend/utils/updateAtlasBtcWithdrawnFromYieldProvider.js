const { getConstants } = require("../constants");
const WithdrawalFromYieldProviderHelper = require("../helpers/withdrawalFromYieldProviderHelper");

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

    let lastWithdrawalData = await WithdrawalFromYieldProviderHelper.getLastWithdrawalData();

    if (lastWithdrawalData.readySendToUser) {
      console.log("[UpdateAtlasBtcWithdrawnFromYieldProvider] Already ready to send to user for yield provider txn hash:", lastWithdrawalData.lastWithdrawalTxHash);
      return;
    }

    if (!lastWithdrawalData.lastWithdrawalTxHash) {
      console.log("[UpdateAtlasBtcWithdrawnFromYieldProvider] No last withdrawal tx hash found");
      return;
    }
    
    const withdrawal = bithiveRecords.find(
      record => record.withdrawTxHash === lastWithdrawalData.lastWithdrawalTxHash
    );

    if (!withdrawal) {
      console.log("[UpdateAtlasBtcWithdrawnFromYieldProvider] No bithive record found for yield provider txn hash", lastWithdrawalData.lastWithdrawalTxHash);
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

    if (allRedemptions.filter(redemption => 
      redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWN &&
      redemption.remarks === "" &&
      redemption.yield_provider_txn_hash === lastWithdrawalData.lastWithdrawalTxHash
    ).length === lastWithdrawalData.totalRecords) {
      console.log("[UpdateAtlasBtcWithdrawnFromYieldProvider] All redemptions have been withdrawn from yield provider");
      // Update readySendToUser to true since all redemptions are withdrawn
      await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData({
        readySendToUser: true
      });
      console.log("[UpdateAtlasBtcWithdrawnFromYieldProvider] Updated readySendToUser to true");
      return;
    }

    // Filter valid redemptions that are in withdrawing state
    // Must have valid addresses, non-empty yield provider txn hash, and gas fee
    const filteredTxns = allRedemptions.filter(
      (redemption) =>
        redemption.abtc_redemption_address !== "" &&
        redemption.abtc_redemption_chain_id !== "" &&
        redemption.btc_receiving_address !== "" &&
        redemption.status ===
          REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWING &&
        redemption.remarks === "" &&
        redemption.yield_provider_txn_hash === lastWithdrawalData.lastWithdrawalTxHash &&
        redemption.yield_provider_gas_fee !== 0,
    );

    for (const redemption of filteredTxns) {
      await near.updateRedemptionWithdrawnFromYieldProvider(
        redemption.txn_hash,
      );
      // Update status in allRedemptions array
      const redemptionToUpdate = allRedemptions.find(r => r.txn_hash === redemption.txn_hash);
      if (redemptionToUpdate) {
        redemptionToUpdate.status = REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWN;
      }
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
