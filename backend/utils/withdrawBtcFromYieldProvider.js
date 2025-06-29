const { createRelayerClient } = require("@bithive/relayer-api");
const bitcoin = require("bitcoinjs-lib");

const redemptionHelper = require("../helpers/redemptionHelper");
const bridgingHelper = require("../helpers/bridgingHelper");
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

  let yieldProviderWithdrawalTxHash = "";
  try {
    console.log(`${batchName}. Start run...`);
    flagsBatch.WithdrawBtcFromYieldProviderRunning = true;

    // Get BTC address and public key
    const { address, publicKey } = await bitcoinInstance.deriveBTCAddress(near);
    const publicKeyString = publicKey.toString("hex");
    const { REDEMPTION_STATUS, BRIDGING_STATUS } = getConstants();
    // Get BitHive account info
    let accountInfo;
    let totalUnstakedAmount = 0;
    try {
      accountInfo = await near.bitHiveContract.view_account({
        user_pubkey: publicKeyString,
      });
      console.log(
        "[WithdrawBtcFromYieldProvider] BitHive account info:",
        accountInfo,
      );
      totalUnstakedAmount = accountInfo.queue_withdrawal_amount;
      if (!accountInfo) {
        console.log(
          "[WithdrawBtcFromYieldProvider] No BitHive account info found",
        );
        return;
      }

      // Check if there's a pending withdrawal
      if (accountInfo.queue_withdrawal_amount > 0) {
        totalUnstakedAmount = accountInfo.queue_withdrawal_amount;
        console.log(
          "[WithdrawBtcFromYieldProvider] Queue withdrawal start time:",
          new Date(accountInfo.queue_withdrawal_start_ts).toLocaleString(),
        );
        console.log(
          "[WithdrawBtcFromYieldProvider] Queue withdrawal end time:",
          new Date(accountInfo.queue_withdrawal_end_ts).toLocaleString(),
        );

        // If we're still in the withdrawal queue period, wait
        const now = Date.now();
        if (now < accountInfo.queue_withdrawal_end_ts) {
          console.log(
            "[WithdrawBtcFromYieldProvider] Still in withdrawal queue period, waiting...",
          );
          return;
        }
      }

      console.log(
        "[WithdrawBtcFromYieldProvider] Withdrawal queue period ended, proceeding...",
      );
    } catch (error) {
      console.error(
        "[WithdrawBtcFromYieldProvider] Error getting BitHive account info:",
        error,
      );
      return;
    }

    // Filter redemptions that need to be processed
    const pendingRedemptions =
      await redemptionHelper.getPendingRedemptionsForWithdrawal(redemptions);

    // Filter bridgings that need to be processed
    const pendingBridgings =
      await bridgingHelper.getPendingBridgingFeesForWithdrawal(bridgings);

    // console.log("pendingRedemptions:", pendingRedemptions);
    // console.log("pendingBridgings:", pendingBridgings);
    // Sum up amounts from redemptions
    for (const redemption of pendingRedemptions) {
      try {
        const redemptionRecord = await near.getRedemptionByTxnHash(redemption.txn_hash);
        if (redemptionRecord.status !== REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING) {
          console.log("[WithdrawBtcFromYieldProvider] Redemption already not in unstake processing:", redemption.txn_hash);
          continue;
        }
        // Get fee rate and limit
        const feeRate = (await bitcoinInstance.fetchFeeRate()) + 1;
        const feeLimit = process.env.MAX_BTC_FEE_LIMIT || 10000;
        console.log("[WithdrawBtcFromYieldProvider] redemption:", redemption);
        console.log("[WithdrawBtcFromYieldProvider] Address:", address);
        console.log(
          "[WithdrawBtcFromYieldProvider] Total amount:",
          redemption.abtc_amount,
        );
        console.log("[WithdrawBtcFromYieldProvider] Fee limit:", feeLimit);
        console.log("[WithdrawBtcFromYieldProvider] Fee rate:", feeRate);

        // Build unsigned PSBT
        const { psbt: unsignedPsbtHex } =
          await relayer.withdraw.buildUnsignedPsbt({
            publicKey: publicKeyString,
            amount: redemption.abtc_amount,
            recipientAddress: address,
            feeLimit: feeLimit,
            feeRate: feeRate,
          });

        console.log("[WithdrawBtcFromYieldProvider] Built unsigned PSBT");

        // Sign PSBT with MPC
        let partiallySignedPsbt =
          await bitcoinInstance.mpcSignYieldProviderPsbt(near, unsignedPsbtHex);

        console.log("partiallySignedPsbt: ", partiallySignedPsbt);

        // Access the nested psbt property from the response
        const psbtInstance = partiallySignedPsbt.psbt;
        const partiallySignedPsbtHex = psbtInstance.toHex();

        console.log(
          "[WithdrawBtcFromYieldProvider] Partially signed PSBT via MPC",
        );

        // Sign PSBT with BitHive chain signatures
        const { psbt: fullySignedPsbt } = await relayer.withdraw.chainSignPsbt({
          psbt: partiallySignedPsbtHex,
        });

        console.log(
          "[WithdrawBtcFromYieldProvider] Fully signed PSBT via BitHive",
        );

        console.log("Fully signed PSBT via BitHive:", fullySignedPsbt);

        let finalisedPsbt = bitcoin.Psbt.fromHex(fullySignedPsbt, {
          network: bitcoinInstance.network,
        });

        console.log("finalisedPsbt:", finalisedPsbt);

        // Calculate withdrawal fee from the finalized PSBT
        const withdrawalFee = finalisedPsbt.getFee();
        console.log(
          "[WithdrawBtcFromYieldProvider] Withdrawal fee:",
          withdrawalFee,
        );

        // Submit finalized PSBT
        const { txHash } = await relayer.withdraw.submitFinalizedPsbt({
          psbt: fullySignedPsbt,
        });

        yieldProviderWithdrawalTxHash = txHash;

        console.log(
          "[WithdrawBtcFromYieldProvider] Withdrawal txHash:",
          yieldProviderWithdrawalTxHash,
        );

        await near.updateRedemptionYieldProviderWithdrawing(
          redemption.txn_hash,
          yieldProviderWithdrawalTxHash,
          withdrawalFee,
        );
        await redemptionHelper.updateOffchainYieldProviderWithdrawing(
          redemptions,
          redemption.txn_hash,
          REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWING,
          yieldProviderWithdrawalTxHash,
          withdrawalFee,
        );
      } catch (error) {
        const remarks = `[withdrawBtcFromYieldProvider] Error in withdrawal process: ${error.message || error}`;
        console.log(remarks);
        if (!remarks.includes("Empty deposit UTXOs")) {
          await near.updateRedemptionRemarks(redemption.txn_hash, remarks);
          await redemptionHelper.updateOffchainRedemptionRemarks(
            redemptions,
            redemption.txn_hash,
            remarks,
          );
        }
        continue;
      }
    }

    // Withdraw fees from yield provider to treasury
    if (pendingBridgings.length > 0) {
      // Sum up amounts from bridgings
      const totalFeesAmountToWithdraw = pendingBridgings.reduce(
        (sum, record) =>
          sum +
          record.minting_fee_sat +
          record.protocol_fee +
          record.bridging_gas_fee_sat,
        0,
      );

      console.log(
        "[withdrawBtcFromYieldProvider] Total fees amount to withdraw from bridgings:",
        totalFeesAmountToWithdraw,
      );

      // Get fee rate and limit
      const feeRate = (await bitcoinInstance.fetchFeeRate()) + 1;
      const feeLimit = process.env.MAX_BTC_FEE_LIMIT || 10000;

      // Build unsigned PSBT
      const { psbt: unsignedPsbtHex } =
        await relayer.withdraw.buildUnsignedPsbt({
          publicKey: publicKeyString,
          amount: totalFeesAmountToWithdraw,
          recipientAddress: atlasTreasuryAddress,
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

      console.log(
        "[WithdrawBtcFromYieldProvider] Partially signed PSBT via MPC",
      );

      // Sign PSBT with BitHive chain signatures
      const { psbt: fullySignedPsbt } = await relayer.withdraw.chainSignPsbt({
        psbt: partiallySignedPsbtHex,
      });

      console.log(
        "[WithdrawBtcFromYieldProvider] Fully signed PSBT via BitHive",
      );

      console.log("Fully signed PSBT via BitHive:", fullySignedPsbt);

      let finalisedPsbt = bitcoin.Psbt.fromHex(fullySignedPsbt, {
        network: bitcoinInstance.network,
      });

      console.log("finalisedPsbt:", finalisedPsbt);

      // Calculate withdrawal fee from the finalized PSBT
      const withdrawalFee = finalisedPsbt.getFee();
      console.log(
        "[WithdrawBtcFromYieldProvider] Withdrawal fee:",
        withdrawalFee,
      );

      // Submit finalized PSBT
      const { txHash } = await relayer.withdraw.submitFinalizedPsbt({
        psbt: fullySignedPsbt,
      });

      yieldProviderWithdrawalTxHash = txHash;

      // yieldProviderWithdrawalTxHash = "02d8a990c57c45a46f4188eb21e4bd40edb98afa3b0ddf8a1766f80ddcf1df94";
      // const withdrawalFee = 466;

      console.log(
        "[WithdrawBtcFromYieldProvider] Withdrawal txHash:",
        yieldProviderWithdrawalTxHash,
      );

      const averageFee = Math.ceil(withdrawalFee / pendingBridgings.length);
      let remainingWithdrawalFee = withdrawalFee;

      //Update all bridgings with the withdrawal txn hash
      for (const bridging of pendingBridgings) {
        try {
          const feeToUse =
            remainingWithdrawalFee > 0
              ? Math.min(averageFee, remainingWithdrawalFee)
              : 0;

          await near.updateBridgingFeesYieldProviderWithdrawing(
            bridging.txn_hash,
            yieldProviderWithdrawalTxHash,
            feeToUse,
          );
          await bridgingHelper.updateOffchainBridgingYieldProviderStatus(
            bridgings,
            bridging.txn_hash,
            BRIDGING_STATUS.ABTC_YIELD_PROVIDER_WITHDRAWING,
          );

          // Subtract the used fee from remaining withdrawal fee
          remainingWithdrawalFee = Math.max(
            0,
            remainingWithdrawalFee - feeToUse,
          );
        } catch (error) {
          const remarks = `[withdrawBtcFromYieldProvider] Error in withdrawal process: ${error.message || error}`;
          console.log(remarks);
          await near.updateBridgingFeesYieldProviderRemarks(
            bridging.txn_hash,
            remarks,
          );
          await bridgingHelper.updateOffchainBridgingYieldProviderRemarks(
            bridgings,
            bridging.txn_hash,
            remarks,
          );
          return;
        }
      }
    }
    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    const remarks = `[withdrawBtcFromYieldProvider] Error in ${batchName}: ${error.message || error}`;
    console.log(remarks);
  } finally {
    flagsBatch.WithdrawBtcFromYieldProviderRunning = false;
  }
}

module.exports = { withdrawBtcFromYieldProvider };
