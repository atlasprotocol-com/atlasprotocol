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
      let pendingRedemptions =
        await redemptionHelper.getPendingRedemptionsForUnstake(redemptions);
      let pendingBridgings =
        await bridgingHelper.getBridgingFeesForUnstake(bridgings);

      const shouldProcessBridgings =
        pendingBridgings.length >=
        Number(process.env.MIN_BRIDGING_RECORDS_TO_SEND_BTC);

      const shouldProcessRedemptions = pendingRedemptions.length > 0;

      let totalAmountToUnstake = 0;
      if (!shouldProcessRedemptions && !shouldProcessBridgings) {
        console.log(
          "[unstakeBtcFromYieldProvider] No pending redemptions and not enough bridgings found",
        );
        return;
      }

      const failedUnstakes = [];
      if (shouldProcessRedemptions) {
        for (const redemption of pendingRedemptions) {
          try {
            if (
              redemption.status !==
              REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING
            ) {
              await near.updateRedemptionYieldProviderUnstakeProcessing(
                redemption.txn_hash,
              );
              await redemptionHelper.updateOffchainRedemptionStatus(
                redemptions,
                redemption.txn_hash,
                REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING,
              );
            }
          } catch (error) {
            const remarks = `Error updating redemption status for ${redemption.txn_hash}: ${error.message || error}`;
            console.error(remarks);
            await near.updateRedemptionRemarks(redemption.txn_hash, remarks);
            await redemptionHelper.updateOffchainRedemptionRemarks(
              redemptions,
              redemption.txn_hash,
              remarks,
            );
            failedUnstakes.push(redemption.txn_hash);
          }
        }

        // Remove failed unstakes from pending redemptions
        const successfulRedemptions = pendingRedemptions.filter(
          (redemption) => !failedUnstakes.includes(redemption.txn_hash),
        );

        totalAmountToUnstake =
          totalAmountToUnstake +
          successfulRedemptions.reduce((total, redemption) => {
            return total + redemption.abtc_amount;
          }, 0);
      }

      if (shouldProcessBridgings) {
        const failedUnstakes = [];

        for (const bridging of pendingBridgings) {
          try {
            if (
              bridging.yield_provider_status !==
              BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING
            ) {
              await near.updateBridgingFeesYieldProviderUnstakeProcessing(
                bridging.txn_hash,
              );
              await bridgingHelper.updateOffchainBridgingStatus(
                bridgings,
                bridging.txn_hash,
                BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING,
              );
            }
          } catch (error) {
            const remarks = `Error updating bridging fees pending yield provider unstake: ${error.message || error}`;
            await near.updateBridgingFeesYieldProviderRemarks(
              bridging.txn_hash,
              remarks,
            );
            await bridgingHelper.updateOffchainBridgingRemarks(
              bridgings,
              bridging.txn_hash,
              remarks,
            );
            failedUnstakes.push(bridging.txn_hash);
          }
        }

        // remove failed ones from the list
        pendingBridgings = pendingBridgings.filter(
          (bridging) => !failedUnstakes.includes(bridging.txn_hash),
        );

        const totalAmountToUnstakeFromBridgings = pendingBridgings.reduce(
          (sum, record) =>
            sum +
            record.minting_fee_sat +
            record.protocol_fee +
            record.bridging_gas_fee_sat,
          0,
        );

        totalAmountToUnstake =
          totalAmountToUnstake + totalAmountToUnstakeFromBridgings;
      }

      if (totalAmountToUnstake > 0) {
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
      }
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
