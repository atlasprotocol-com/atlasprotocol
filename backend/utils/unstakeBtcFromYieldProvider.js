const { createRelayerClient } = require("@bithive/relayer-api");

const { getConstants } = require("../constants");
const redemptionHelper = require("../helpers/redemptionHelper");
const bridgingHelper = require("../helpers/bridgingHelper");

const { flagsBatch } = require("./batchFlags");

async function unstakeBtcFromYieldProvider(
  near,
  bitcoinInstance,
  redemptions,
  bridgings,
) {
  const batchName = "Batch UnstakeBtcFromYieldProvider";
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.UnstakeBtcFromYieldProviderRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run...`);
    flagsBatch.UnstakeBtcFromYieldProviderRunning = true;

    const { publicKey } = await bitcoinInstance.deriveBTCAddress(near);
    const publicKeyString = publicKey.toString("hex");

    // Get BitHive account info
    let accountInfo;
    let totalUnstakedAmount = 0;
    try {
      accountInfo = await near.bitHiveContract.view_account({
        user_pubkey: publicKeyString,
      });
      console.log(
        "[unstakeBtcFromYieldProvider] BitHive account info:",
        accountInfo,
      );
      totalUnstakedAmount = accountInfo.queue_withdrawal_amount;
      if (!accountInfo) {
        console.log(
          "[unstakeBtcFromYieldProvider] No BitHive account info found",
        );
        return;
      }

      // Check if there's a pending withdrawal
      if (totalUnstakedAmount > 0) {
       
        console.log(
          "[unstakeBtcFromYieldProvider] Total unstaked amount:",
          totalUnstakedAmount,
        );
       
        console.log(
          "[unstakeBtcFromYieldProvider] There is a pending withdrawal, waiting...",
        );
        return;
      }

      console.log(
        "[unstakeBtcFromYieldProvider] No unstaked amount, proceeding...",
      );
    } catch (error) {
      console.error(
        "[WithdrawBtcFromYieldProvider] Error getting BitHive account info:",
        error,
      );
      return;
    }
    

    const { REDEMPTION_STATUS, BRIDGING_STATUS } = getConstants();

    try {
      const pendingRedemptions =
        await redemptionHelper.getPendingRedemptionsForUnstake(redemptions);
      //const pendingBridgings = await bridgingHelper.getBridgingFeesForUnstake(bridgings);

      if (pendingRedemptions.length === 0) {
        console.log("[unstakeBtcFromYieldProvider] No pending redemptions found");
        return;
      }

      const failedUnstakes = [];
      for (const redemption of pendingRedemptions) {
        try {
          if (redemption.status !== REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING) {
            await near.updateRedemptionYieldProviderUnstakeProcessing(redemption.txn_hash);
            await redemptionHelper.updateOffchainRedemptionStatus(
                redemptions,
                redemption.txn_hash,
                REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING
            );
          }
        } catch (error) {
          console.error(`Error updating redemption status for ${redemption.txn_hash}:`, error);
          failedUnstakes.push(redemption.txn_hash);
        }
      }

      // Remove failed unstakes from pending redemptions
      const successfulRedemptions = pendingRedemptions.filter(
        redemption => !failedUnstakes.includes(redemption.txn_hash)
      );

      // Update bridging statuses if any
      // const processingBridgings = bridgings.filter(
      //   bridging => bridging.status === BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING
      // );

      // for (const bridging of processingBridgings) {
      //   try {
      //     await near.updateBridgingFeesYieldProviderUnstaked(bridging.txn_hash);
      //     // Update local array
      //     const bridgingToUpdate = bridgings.find(b => b.txn_hash === bridging.txn_hash);
      //     if (bridgingToUpdate) {
      //       bridgingToUpdate.status = BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKED;
      //     }
      //   } catch (error) {
      //     console.error(`Error updating bridging status for ${bridging.txn_hash}:`, error);
      //     await near.updateBridgingFeesYieldProviderRemarks(
      //       bridging.txn_hash,
      //       `Error updating bridging status: ${error.message || error}`
      //     );
      //   }
      // }

      // Calculate total amount to unstake from all pending redemptions
      const totalAmountToUnstake = successfulRedemptions.reduce(
        (total, redemption) => {
          return total + redemption.abtc_amount;
        },
        0,
      );

      console.log(
        "[unstakeBtcFromYieldProvider] Total amount to unstake:",
        totalAmountToUnstake,
      );

      const { message } = await relayer.unstake.buildUnsignedMessage({
        amount: totalAmountToUnstake,
        publicKey: publicKeyString,
      });
      console.log("message:", message);
      const unstakeSignature = await bitcoinInstance.mpcSignMessage(
        near,
        message,
      );

      console.log("totalAmountToUnstake:", totalAmountToUnstake);
      console.log("publicKeyString:", publicKeyString);
      console.log("unstakeSignature:", unstakeSignature.toString("hex"));

      await relayer.unstake.submitSignature({
        amount: totalAmountToUnstake,
        publicKey: publicKeyString,
        signature: unstakeSignature.toString("hex"),
      });

    } catch (error) {
      console.error("Error unstaking BTC from yield provider:", error);
    }
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UnstakeBtcFromYieldProviderRunning = false;
  }
}

module.exports = { unstakeBtcFromYieldProvider };
