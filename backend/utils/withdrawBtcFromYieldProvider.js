const { createRelayerClient } = require("@bithive/relayer-api");
const bitcoin = require('bitcoinjs-lib');

const redemptionHelper = require("../helpers/redemptionHelper");
const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

/**
 * Handles withdrawing BTC from the yield provider for redemptions and bridging operations
 * @param {Object} near - Near protocol instance for making contract calls
 * @param {Object} bitcoinInstance - Bitcoin instance for blockchain operations
 * @param {Array} redemptions - Array of all redemption records
 * @param {Array} bridgings - Array of all bridging records
 * @param {string} atlasTreasuryAddress - Atlas treasury address for fees
 */
async function withdrawBtcFromYieldProvider(
  near,
  bitcoinInstance,
  redemptions,
  bridgings,
  atlasTreasuryAddress,
) {
  const batchName = "Batch Q WithdrawBtcFromYieldProvider";
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.WithdrawBtcFromYieldProviderRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }

  let yieldProviderWithdrawalTxHash= "";
  try {
    console.log(`${batchName}. Start run...`);
    flagsBatch.WithdrawBtcFromYieldProviderRunning = true;

    // Get BTC address and public key
    const { address, publicKey } = await bitcoinInstance.deriveBTCAddress(near);
    const publicKeyString = publicKey.toString("hex");
    const { REDEMPTION_STATUS } = getConstants();
    // Get BitHive account info
    let accountInfo;
    let totalUnstakedAmount = 0;
    try {
      accountInfo = await near.bitHiveContract.view_account({user_pubkey: publicKeyString});
      console.log("[WithdrawBtcFromYieldProvider] BitHive account info:", accountInfo);
      totalUnstakedAmount = accountInfo.queue_withdrawal_amount;
      if (!accountInfo) {
        console.log("[WithdrawBtcFromYieldProvider] No BitHive account info found");
        return;
      }

      // Check if there's a pending withdrawal
      if (accountInfo.queue_withdrawal_amount > 0) {
        totalUnstakedAmount = accountInfo.queue_withdrawal_amount;
        console.log("[WithdrawBtcFromYieldProvider] Queue withdrawal start time:", new Date(accountInfo.queue_withdrawal_start_ts).toLocaleString());
        console.log("[WithdrawBtcFromYieldProvider] Queue withdrawal end time:", new Date(accountInfo.queue_withdrawal_end_ts).toLocaleString());
        
        // If we're still in the withdrawal queue period, wait
        const now = Date.now();
        if (now < accountInfo.queue_withdrawal_end_ts) {
          console.log("[WithdrawBtcFromYieldProvider] Still in withdrawal queue period, waiting...");
          return;
        } 
      }

      console.log("[WithdrawBtcFromYieldProvider] Withdrawal queue period ended, proceeding...");

    } catch (error) {
      console.error("[WithdrawBtcFromYieldProvider] Error getting BitHive account info:", error);
      return;
    }

    // Filter redemptions that need to be processed
    const pendingRedemptions = await redemptionHelper.getPendingRedemptionsForWithdrawal(
      redemptions
    );

    console.log("[WithdrawBtcFromYieldProvider] Pending redemptions:", pendingRedemptions);

    // // Filter bridgings that need to be processed
    // const pendingBridgings = bridgings.filter(bridging => {
    //   try {
    //     const chainConfig = getChainConfig(bridging.dest_chain_id);
    //     return bridging.yield_provider_status === BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING &&
    //       bridging.remarks === "" &&
    //       bridging.yield_provider_txn_hash === "" &&
    //       bridging.verified_count >= chainConfig.validators_threshold;
    //   } catch (error) {
    //     const remarks = `Chain config not found for chain ID: ${bridging.dest_chain_id}`;
    //     near.updateBridgingFeesYieldProviderRemarks(bridging.txn_hash, remarks);
    //     return false;
    //   }
    // });

    // const totalRecords = pendingRedemptions.length + pendingBridgings.length;
    const totalRecords = pendingRedemptions.length;
    console.log("[WithdrawBtcFromYieldProvider] Total records:", totalRecords);
    if (totalRecords === 0) {
      console.log("[WithdrawBtcFromYieldProvider] No transactions to process");
      return;
    }

    // Calculate total amount to withdraw
    let totalAmount = 0;
    let totalNewAmount = 0;

    // Sum up amounts from redemptions
    for (const redemption of pendingRedemptions) {
      
      try {
        // Sum up amounts from bridgings
        // for (const bridging of pendingBridgings) {
        //   totalAmount += bridging.abtc_amount;
        //   totalNewAmount += bridging.abtc_amount;
        // }

      // Get fee rate and limit
      const feeRate = (await bitcoinInstance.fetchFeeRate()) + 1;
      const feeLimit = process.env.MAX_BTC_FEE_LIMIT || 10000;
      console.log("[WithdrawBtcFromYieldProvider] redemption:", redemption);
      console.log("[WithdrawBtcFromYieldProvider] Address:", address);
      console.log("[WithdrawBtcFromYieldProvider] Total amount:", redemption.abtc_amount);
      console.log("[WithdrawBtcFromYieldProvider] Fee limit:", feeLimit);
      console.log("[WithdrawBtcFromYieldProvider] Fee rate:", feeRate);
      
      
      // Build unsigned PSBT
      const { psbt: unsignedPsbtHex } = await relayer.withdraw.buildUnsignedPsbt({
        publicKey: publicKeyString,
        amount: redemption.abtc_amount,
        recipientAddress: address,
        feeLimit: feeLimit,
        feeRate: feeRate,
      });

      console.log("[WithdrawBtcFromYieldProvider] Built unsigned PSBT");

      // Sign PSBT with MPC
      let partiallySignedPsbt = await bitcoinInstance.mpcSignYieldProviderPsbt(
        near,
        unsignedPsbtHex,
      );

      console.log("partiallySignedPsbt: ", partiallySignedPsbt);

      // Access the nested psbt property from the response
      const psbtInstance = partiallySignedPsbt.psbt;
      const partiallySignedPsbtHex = psbtInstance.toHex();

      console.log("[WithdrawBtcFromYieldProvider] Partially signed PSBT via MPC");

      // Sign PSBT with BitHive chain signatures
      const { psbt: fullySignedPsbt } = await relayer.withdraw.chainSignPsbt({
        psbt: partiallySignedPsbtHex,
      });

      console.log("[WithdrawBtcFromYieldProvider] Fully signed PSBT via BitHive");

      console.log("Fully signed PSBT via BitHive:", fullySignedPsbt);

      let finalisedPsbt = bitcoin.Psbt.fromHex(fullySignedPsbt, {
        network: bitcoinInstance.network,
      });

      console.log("finalisedPsbt:", finalisedPsbt);
      
      // Calculate withdrawal fee from the finalized PSBT
      const withdrawalFee = finalisedPsbt.getFee();
      console.log("[WithdrawBtcFromYieldProvider] Withdrawal fee:", withdrawalFee);

      // Submit finalized PSBT
      const { txHash } = await relayer.withdraw.submitFinalizedPsbt({
        psbt: fullySignedPsbt,
      });

      yieldProviderWithdrawalTxHash = txHash;

      console.log("[WithdrawBtcFromYieldProvider] Withdrawal txHash:", yieldProviderWithdrawalTxHash);

      near.updateRedemptionYieldProviderWithdrawing(redemption.txn_hash, yieldProviderWithdrawalTxHash, withdrawalFee);
      redemptionHelper.updateOffchainRedemptionStatus(redemption.txn_hash, REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWING);
      
      } catch (error) {
        console.error("[WithdrawBtcFromYieldProvider] Error processing redemption:", error);
        const remarks = `Error in withdrawal process: ${error.message || error}`;
        near.updateRedemptionRemarks(redemption.txn_hash, remarks);
        redemptionHelper.updateOffchainRedemptionRemarks(redemption.txn_hash, remarks);
        return;
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error in ${batchName}:`, error);
    const remarks = `Error in withdrawal process: ${error.message || error}`;
    // await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData({
    //   errorMessage: remarks
    // });
  } finally {
    flagsBatch.WithdrawBtcFromYieldProviderRunning = false;
  }
}

module.exports = { withdrawBtcFromYieldProvider }; 