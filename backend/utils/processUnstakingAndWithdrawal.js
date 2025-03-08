const bitcoin = require("bitcoinjs-lib");
const { createRelayerClient } = require("@bithive/relayer-api");

const { getConstants } = require("../constants");
const unstakingConfig = require("../config/unstakingConfig");
const { globalParams, updateGlobalParams } = require("../config/globalParams");

const { flagsBatch } = require("./batchFlags");

async function processUnstakingAndWithdrawal(
  near,
  bitcoinInstance,
  atlasTreasuryAddress,
) {
  const batchName = "Batch ProcessUnstakingAndWithdrawal";
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.ProcessUnstakingAndWithdrawalRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run...`);
    flagsBatch.ProcessUnstakingAndWithdrawalRunning = true;
    await updateGlobalParams(near);
    // Step 1: Check Unstaking Eligibility
    const lastUnstakingTime = globalParams.lastUnstakingTime;
    const unstakingPeriod = await unstakingConfig.getUnstakingPeriod(near);
    const nextEligibleTime =
      lastUnstakingTime === 0
        ? Date.now()
        : lastUnstakingTime + unstakingPeriod;

    console.log(`Last unstaking time: ${lastUnstakingTime}`);
    console.log(`Unstaking period: ${unstakingPeriod}`);
    console.log(`Next eligible time: ${nextEligibleTime}`);

    if (Date.now() <= nextEligibleTime) {
      console.log(
        "Not yet eligible for unstaking. Waiting for unstaking period to complete.",
      );
      console.log(
        `Time remaining: ${(nextEligibleTime - Date.now()) / 1000} seconds`,
      );
      return;
    }
    const { REDEMPTION_STATUS, BRIDGING_STATUS } = getConstants();
    // Step 2: Process Pending Withdrawals

    // Get all pending redemptions and bridging records
    const pendingRedemptions =
      await near.getRedemptionsForYieldProviderByStatusAndTimestamp(
        REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING,
        lastUnstakingTime,
      );
    const pendingBridgings =
      await near.getBridgingsForYieldProviderByStatusAndTimestamp(
        BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING,
        lastUnstakingTime,
      );

    console.log("\x1b[33mWithdrawal: \x1b[0m");
    console.log(
      "\x1b[33mPending redemptions: " + pendingRedemptions.length + "\x1b[0m",
    );
    console.log(
      "\x1b[33mPending bridgings: " + pendingBridgings.length + "\x1b[0m",
    );

    // If there are pending withdrawals, process them first
    if (pendingRedemptions.length > 0 || pendingBridgings.length > 0) {
      try {
        for (const redemption of pendingRedemptions) {
          await near.updateRedemptionPendingYieldProviderWithdraw(
            redemption.txn_hash,
          );
        }

        for (const bridging of pendingBridgings) {
          await near.updateBridgingFeesPendingYieldProviderWithdraw(
            bridging.txn_hash,
          );
        }

        //Process withdrawals logic...
        const totalAbtcAmount = pendingRedemptions.reduce(
          (sum, record) => sum + record.abtc_amount,
          0,
        );
        const totalFeesAmount = pendingBridgings.reduce(
          (sum, record) =>
            sum +
            record.minting_fee_sat +
            record.protocol_fee +
            record.bridging_gas_fee_sat,
          0,
        );

        let partiallySignedPsbtHex = undefined;
        let withdrawnDeposits;
        let _deposits;

        const { publicKey, address } =
          await bitcoinInstance.deriveBTCAddress(near);
        const publicKeyString = publicKey.toString("hex");

        const totalAmount = totalAbtcAmount + totalFeesAmount;
        console.log("totalAbtcAmount:", totalAbtcAmount);
        console.log("totalFeesAmount:", totalFeesAmount);
        console.log("totalAmount:", totalAmount);

        const { account } = await relayer.user.getAccount({
          publicKey: publicKeyString,
        });

        if (account.pendingSignPsbt) {
          // If there's a pending PSBT for signing, user cannot request signing a new PSBT
          partiallySignedPsbtHex = account.pendingSignPsbt.psbt;
          withdrawnDeposits = account.pendingSignPsbt.deposits;
          console.warn(
            `[Warning] The account with public key (${publicKey}) has a pending withdrawal PSBT that has not been signed by NEAR Chain Signatures. ` +
              `The signing request is either still in progress or has failed in the last attempt. ` +
              `We need to complete signing this withdrawal PSBT before we can submit a new one: ${JSON.stringify(account.pendingSignPsbt, null, 2)}.\n` +
              `Submit the above withdrawal PSBT for signing ... This may fail if the last signing request is still in progress, or NEAR Chain Signatures service is unstable.`,
          );
        } else {
          const feeRate = (await bitcoinInstance.fetchFeeRate()) + 1;

          const { psbt: unsignedPsbtHex, deposits: depositsToSign } =
            await relayer.withdraw.buildUnsignedPsbt({
              publicKey: publicKeyString,
              deposits: _deposits,
              amount: totalAmount,
              recipientAddress: address,
              feeRate: feeRate,
            });

          let partiallySignedPsbt = await bitcoinInstance.mpcSignPsbt(
            near,
            unsignedPsbtHex,
          );

          partiallySignedPsbtHex = partiallySignedPsbt.toHex();

          withdrawnDeposits = depositsToSign;
        }

        console.log("Patially signed PSBT via MPC:", partiallySignedPsbtHex);

        const depositTxHash = withdrawnDeposits[0].txHash;
        console.log("depositTxHash:", depositTxHash);

        //Sign the PSBT with BitHive NEAR Chain Signatures
        const { psbt: fullySignedPsbt } = await relayer.withdraw.chainSignPsbt({
          psbt: partiallySignedPsbtHex,
        });

        console.log("Fully signed PSBT via BitHive:", fullySignedPsbt);

        let finalisedPsbt = bitcoin.Psbt.fromHex(fullySignedPsbt, {
          network: bitcoinInstance.network,
        });

        console.log("finalisedPsbt:", finalisedPsbt);

        let yieldProviderWithdrawalFee = finalisedPsbt.getFee();
        console.log("finalisedPsbt.getFee() ", yieldProviderWithdrawalFee);

        const totalRecords = pendingRedemptions.length + pendingBridgings.length;
        const baseGasPerRecord = Math.floor(yieldProviderWithdrawalFee / totalRecords);
        const remainder = yieldProviderWithdrawalFee % totalRecords;
        
        console.log("Total records:", totalRecords);
        console.log("Base gas per record:", baseGasPerRecord);
        console.log("Remainder to distribute:", remainder);

        // Create arrays to hold the actual gas distribution
        const redemptionGasFees = new Array(pendingRedemptions.length).fill(baseGasPerRecord);
        const bridgingGasFees = new Array(pendingBridgings.length).fill(baseGasPerRecord);

        // Distribute the remainder one by one across records
        for (let i = 0; i < remainder; i++) {
            if (i < pendingRedemptions.length) {
                redemptionGasFees[i]++;
            } else {
                bridgingGasFees[i - pendingRedemptions.length]++;
            }
        }

        // Verify total distribution equals original fee
        const totalDistributed = redemptionGasFees.reduce((a, b) => a + b, 0) + 
                               bridgingGasFees.reduce((a, b) => a + b, 0);
        console.log("Total gas distributed:", totalDistributed);
        console.log("Original withdrawal fee:", yieldProviderWithdrawalFee);

        // Submit the finalized PSBT for broadcasting and relaying
        const { txHash: yieldProviderWithdrawalTxHash } =
          await relayer.withdraw.submitFinalizedPsbt({
            psbt: fullySignedPsbt,
          });

        console.log("Withdrawal txHash:", yieldProviderWithdrawalTxHash);

        // Update records with individual gas fees
        for (let i = 0; i < pendingRedemptions.length; i++) {
          await near.updateRedemptionYieldProviderWithdrawing(
            pendingRedemptions[i].txn_hash,
            depositTxHash,
            redemptionGasFees[i],
          );
        }

        for (let i = 0; i < pendingBridgings.length; i++) {
          await near.updateBridgingFeesYieldProviderWithdrawing(
            pendingBridgings[i].txn_hash,
            depositTxHash,
            bridgingGasFees[i]
          );
        }
      } catch (error) {
        console.error("Error in withdrawal process:", error);
        const remarks = `Error in withdrawal process: ${error.message || error}`;

        for (const redemption of pendingRedemptions) {
          await near.updateRedemptionRemarks(redemption.txn_hash, remarks);
        }

        for (const bridging of pendingBridgings) {
          await near.updateBridgingFeesYieldProviderRemarks(
            bridging.txn_hash,
            remarks,
          );
        }
      }
    }

    try {
      // Step 4: Process New Unstaking Requests
      const newRedemptions =
        await near.getRedemptionsForYieldProviderByStatusAndTimestamp(
          REDEMPTION_STATUS.ABTC_BURNT,
          nextEligibleTime,
        );
      const newBridgings =
        await near.getBridgingsForYieldProviderByStatusAndTimestamp(
          BRIDGING_STATUS.ABTC_BURNT,
          nextEligibleTime,
        );

      console.log("\x1b[34mUnstaking: \x1b[0m");
      console.log(
        "\x1b[34mNew redemptions: " + newRedemptions.length + "\x1b[0m",
      );
      console.log("\x1b[34mNew bridgings: " + newBridgings.length + "\x1b[0m");

      console.log("process.env.MIN_BRIDGING_RECORDS_TO_SEND_BTC:", process.env.MIN_BRIDGING_RECORDS_TO_SEND_BTC);
      const shouldProcessBridgings = newBridgings.length >= Number(process.env.MIN_BRIDGING_RECORDS_TO_SEND_BTC);
      const shouldProcessRedemptions = newRedemptions.length > 0;

      if (shouldProcessRedemptions || shouldProcessBridgings) {
        let totalNewAmount = 0;

        // Process redemptions if conditions met
        if (shouldProcessRedemptions) {
          for (const redemption of newRedemptions) {
            await near.updateRedemptionPendingYieldProviderUnstake(
              redemption.txn_hash,
            );
          }
          const totalNewAbtcAmount = newRedemptions.reduce(
            (sum, record) => sum + record.abtc_amount,
            0,
          );
          totalNewAmount += totalNewAbtcAmount;
          console.log(`Total new abtc amount: ${totalNewAbtcAmount}`);
        }

        // Process bridgings if conditions met  
        if (shouldProcessBridgings) {
          for (const bridging of newBridgings) {
            await near.updateBridgingFeesPendingYieldProviderUnstake(
              bridging.txn_hash,
            );
          }
          const totalNewFeesAmount = newBridgings.reduce(
            (sum, record) =>
              sum +
              record.minting_fee_sat +
              record.protocol_fee +
              record.bridging_gas_fee_sat,
            0,
          );
          totalNewAmount += totalNewFeesAmount;
          console.log(`Total new bridging fees amount: ${totalNewFeesAmount}`);
        }

        console.log("totalNewAmount:", totalNewAmount);

        // Get Bitcoin address and public key
        const { publicKey } = await bitcoinInstance.deriveBTCAddress(near);
        const publicKeyString = publicKey.toString("hex");
        let _deposits;
        // Initiate unstaking
        const { message } = await relayer.unstake.buildUnsignedMessage({
          deposits: _deposits,
          amount: totalNewAmount,
          publicKey: publicKeyString,
        });
        console.log("message:", message);
        const unstakeSignature = await bitcoinInstance.mpcSignMessage(
          near,
          message,
        );

        await relayer.unstake.submitSignature({
          amount: totalNewAmount,
          publicKey: publicKeyString,
          signature: unstakeSignature.toString("hex"),
        });

        // Update record statuses
        if (shouldProcessRedemptions) {
          for (const redemption of newRedemptions) {
            await near.updateRedemptionYieldProviderUnstakeProcessing(
              redemption.txn_hash,
            );
          }
        }

        if (shouldProcessBridgings) {
          for (const bridging of newBridgings) {
            await near.updateBridgingFeesYieldProviderUnstakeProcessing(
              bridging.txn_hash,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error processing new unstaking requests:", error);

      // Add error remarks to redemptions
      for (const redemption of newRedemptions) {
        await near.updateRedemptionRemarks(
          redemption.txn_hash,
          error.message || error.toString(),
        );
      }

      // Add error remarks to bridgings
      for (const bridging of newBridgings) {
        await near.updateBridgingFeesYieldProviderRemarks(
          bridging.txn_hash,
          error.message || error.toString(),
        );
      }
    }

    const newLastUnstakingTime = Date.now();
    // Step 3: Update last unstaking time before processing new unstaking requests
    await near.updateLastUnstakingTime(newLastUnstakingTime);
    globalParams.last_unstaking_time = newLastUnstakingTime;
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.ProcessUnstakingAndWithdrawalRunning = false;
  }
}

module.exports = { processUnstakingAndWithdrawal };
