const { getConstants } = require("../constants");
const WithdrawalFromYieldProviderHelper = require("../helpers/withdrawalFromYieldProviderHelper");

const { flagsBatch } = require("./batchFlags");
const { getChainConfig } = require("./network.chain.config");


/**
 * Updates the status of BTC redemptions that are being withdrawn from yield provider
 * @param {Array} allRedemptions - Array of all redemption records
 * @param {Array} allBridgings - Array of all bridging records
 * @param {Object} near - Near protocol instance for making contract calls
 */
async function UpdateAtlasBtcWithdrawingFromYieldProvider(
  allRedemptions,
  allBridgings,
  near,
) {
  const batchName = `Batch H UpdateAtlasBtcWithdrawingFromYieldProvider`;
  
  // Get status constants
  const { REDEMPTION_STATUS, BRIDGING_STATUS } = getConstants();

  // Prevent concurrent batch runs
  if (flagsBatch.UpdateAtlasBtcWithdrawingFromYieldProviderRunning) return;

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcWithdrawingFromYieldProviderRunning = true;

    let lastWithdrawalData = await WithdrawalFromYieldProviderHelper.getLastWithdrawalData();

    if (!lastWithdrawalData.lastWithdrawalTxHash) {
      console.log("[UpdateAtlasBtcWithdrawingFromYieldProvider] No last withdrawal tx hash found");
      return;
    }
    console.log("lastWithdrawalData", lastWithdrawalData);

    let pendingRedemptions = allRedemptions.filter(
      redemption => {
        try {
          const chainConfig = getChainConfig(redemption.abtc_redemption_chain_id);
          return redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING &&
            redemption.remarks === "" &&
            redemption.yield_provider_txn_hash === "" &&
            redemption.verified_count >= chainConfig.validators_threshold;
        } catch (error) {
          const remarks = `Chain config not found for chain ID: ${redemption.abtc_redemption_chain_id}`;
          near.updateRedemptionRemarks(redemption.txn_hash, remarks);
          return false;
        }
      }
    );
    
    let pendingBridgings = allBridgings.filter(
      bridging => {
        try {
          const chainConfig = getChainConfig(bridging.dest_chain_id);
          return bridging.yield_provider_status === BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING &&
            bridging.remarks === "" &&
            bridging.yield_provider_txn_hash === "" &&
            bridging.verified_count >= chainConfig.validators_threshold;
        } catch (error) {
          console.log("error", error);
          const remarks = `Chain config not found for chain ID: ${bridging.dest_chain_id}`;
          near.updateBridgingFeesYieldProviderRemarks(bridging.txn_hash, remarks);
          return false;
        }
      }
    );

    const totalRecords = pendingRedemptions.length + pendingBridgings.length;

    console.log("filteredTxns to update withdrawing from yield provider", totalRecords);
    if (totalRecords === 0) {
      console.log("[UpdateAtlasBtcWithdrawingFromYieldProvider] No transactions to process");
      // Clear the last withdrawal data since there are no transactions to process
      // await WithdrawalFromYieldProviderHelper.clearLastWithdrawalData();
      return;
    }
    
    const baseGasPerRecord = Math.ceil(lastWithdrawalData.withdrawalFee / totalRecords);

    console.log("lastWithdrawalData.withdrawalFee", lastWithdrawalData.withdrawalFee);
    console.log("totalRecords", totalRecords);
    console.log("baseGasPerRecord", baseGasPerRecord);

    // Update records with individual gas fees and status
    for (let i = 0; i < pendingRedemptions.length; i++) {
      try {
        const yieldProviderWithdrawalFee = lastWithdrawalData.withdrawalFee > baseGasPerRecord ? baseGasPerRecord : lastWithdrawalData.withdrawalFee;
        await near.updateRedemptionYieldProviderWithdrawing(
          pendingRedemptions[i].txn_hash,
          lastWithdrawalData.lastWithdrawalTxHash,
          yieldProviderWithdrawalFee,
        );
        
        // Update status in allRedemptions array
        const redemptionToUpdate = allRedemptions.find(r => r.txn_hash === pendingRedemptions[i].txn_hash);
        if (redemptionToUpdate) {
          redemptionToUpdate.status = REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWING;
          redemptionToUpdate.yield_provider_txn_hash = lastWithdrawalData.lastWithdrawalTxHash;
          redemptionToUpdate.yield_provider_gas_fee = yieldProviderWithdrawalFee;
        }
        // Subtract the fee after successful update and save to file
        lastWithdrawalData.withdrawalFee -= yieldProviderWithdrawalFee;
        await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData(lastWithdrawalData);
      } catch (error) {
        const remarks = `Error in updating redemption yield provider withdrawing: ${error.message || error}`;
        console.log("remarks", remarks);
      }
    }

    for (let i = 0; i < pendingBridgings.length; i++) {
      try { 
        const yieldProviderWithdrawalFee = lastWithdrawalData.withdrawalFee > baseGasPerRecord ? baseGasPerRecord : lastWithdrawalData.withdrawalFee;
        await near.updateBridgingFeesYieldProviderWithdrawing(
          pendingBridgings[i].txn_hash,
          lastWithdrawalData.lastWithdrawalTxHash,
          yieldProviderWithdrawalFee,
        );
        
        // Update status in allBridgings array
        const bridgingToUpdate = allBridgings.find(b => b.txn_hash === pendingBridgings[i].txn_hash);
        if (bridgingToUpdate) {
          bridgingToUpdate.yield_provider_status = BRIDGING_STATUS.ABTC_YIELD_PROVIDER_WITHDRAWING;
          bridgingToUpdate.yield_provider_txn_hash = lastWithdrawalData.lastWithdrawalTxHash;
          bridgingToUpdate.yield_provider_gas_fee = yieldProviderWithdrawalFee;
        }

        // Subtract the fee after successful update and save to file
        lastWithdrawalData.withdrawalFee -= yieldProviderWithdrawalFee;
        await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData(lastWithdrawalData);
      } catch (error) {
        const remarks = `Error in updating bridging fees yield provider withdrawing: ${error.message || error}`;
        console.log("remarks", remarks);
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    // Reset running flag regardless of success/failure
    flagsBatch.UpdateAtlasBtcWithdrawingFromYieldProviderRunning = false;
  }
}

module.exports = { UpdateAtlasBtcWithdrawingFromYieldProvider };
