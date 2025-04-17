const bitcoin = require("bitcoinjs-lib");
const { createRelayerClient } = require("@bithive/relayer-api");

const WithdrawalFromYieldProviderHelper = require('../helpers/withdrawalFromYieldProviderHelper');
const { getConstants } = require("../constants");
const unstakingConfig = require("../config/unstakingConfig");
const { globalParams, updateGlobalParams } = require("../config/globalParams");

const { getChainConfig } = require("./network.chain.config");
const { flagsBatch } = require("./batchFlags");

async function processUnstakingAndWithdrawal(
  near,
  bitcoinInstance,
  redemptions,
  bridgings,
  atlasTreasuryAddress,
) {
  const batchName = "Batch N ProcessUnstakingAndWithdrawal";
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.ProcessUnstakingAndWithdrawalRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run...`);
    flagsBatch.ProcessUnstakingAndWithdrawalRunning = true;

    let lastWithdrawalData = await WithdrawalFromYieldProviderHelper.getLastWithdrawalData();
    
    // Check if lastWithdrawalTxHash is blank before proceeding
    if (lastWithdrawalData.lastWithdrawalTxHash) {
      console.log('Previous withdrawal still processing. Last withdrawal tx hash:', lastWithdrawalData.lastWithdrawalTxHash);
      return;
    }

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

    // Step 2: Withdraw from yield provider
    console.log("\x1b[33mWithdrawal: \x1b[0m");
    console.log(
      "\x1b[33mTotal amount to withdraw: " + lastWithdrawalData.totalNewAmount + "\x1b[0m",
    );

    if (lastWithdrawalData.totalNewAmount > 0) {
      try {
        let partiallySignedPsbtHex = undefined;
        let withdrawnDeposits;
        let _deposits;

        const { publicKey, address } =
          await bitcoinInstance.deriveBTCAddress(near);
        const publicKeyString = publicKey.toString("hex");

        const totalAmount = lastWithdrawalData.totalNewAmount;
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

        // Submit the finalized PSBT for broadcasting and relaying
        const { txHash: yieldProviderWithdrawalTxHash } =
          await relayer.withdraw.submitFinalizedPsbt({
            psbt: fullySignedPsbt,
          });

        console.log("Withdrawal txHash:", yieldProviderWithdrawalTxHash);
        
        // Update withdrawal data
        await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData({
          lastWithdrawalTxHash: yieldProviderWithdrawalTxHash,
          withdrawalFee: yieldProviderWithdrawalFee
        });

      } catch (error) {
        console.error("Error in withdrawal process:", error);
        const remarks = `Error in withdrawal process: ${error.message || error}`;

        await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData({
          errorMessage: remarks
        });
      }

    }

    let newRedemptions = [];
    let newBridgings = [];

    if (lastWithdrawalData.errorMessage) {
      console.log('Previous withdrawal failed. Error message:', lastWithdrawalData.errorMessage);
      return;
    }

    if (lastWithdrawalData.totalNewAmount !== 0) {
      console.log('Previous unstaking request still processing. Total new amount:', lastWithdrawalData.totalNewAmount);
      return;
    }

    // Check if lastWithdrawalTxHash is blank before proceeding
    if (lastWithdrawalData.lastWithdrawalTxHash) {
      console.log('Previous withdrawal still processing. Last withdrawal tx hash:', lastWithdrawalData.lastWithdrawalTxHash);
      return;
    }

    try {
      // Step 4: Process New Unstaking Requests
      newRedemptions = redemptions.filter(
        redemption => {
          try {
            const chainConfig = getChainConfig(redemption.abtc_redemption_chain_id);
            return (redemption.status === REDEMPTION_STATUS.ABTC_BURNT || redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING) &&
              redemption.remarks === "" &&
              redemption.verified_count >= chainConfig.validators_threshold;
          } catch (error) {
            const remarks = `Chain config not found for chain ID: ${redemption.abtc_redemption_chain_id}`;
            near.updateRedemptionRemarks(redemption.txn_hash, remarks);
            return false;
          }
        }
      );
      newBridgings = bridgings.filter(
        bridging => {
          try {
            const chainConfig = getChainConfig(bridging.dest_chain_id);
            return bridging.status === BRIDGING_STATUS.ABTC_BURNT &&
              bridging.remarks === "" &&
              bridging.verified_count >= chainConfig.validators_threshold;
          } catch (error) {
            const remarks = `Chain config not found for chain ID: ${bridging.dest_chain_id}`;
            near.updateBridgingFeesYieldProviderRemarks(bridging.txn_hash, remarks);
            return false;
          }
        }
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
          const failedUnstakes = [];

          //console.log("[processRedemptions] Redemptions to unstake:", newRedemptions.length);
          let index = 0;
          for (const redemption of newRedemptions) {
            try {
              index++;
              //console.log("[processRedemptions] Processing redemption:", index, "of", newRedemptions.length);
              if (redemption.status === REDEMPTION_STATUS.ABTC_BURNT) {
                await near.updateRedemptionYieldProviderUnstakeProcessing(redemption.txn_hash);
                //console.log("[processRedemptions] Updated redemption onchain status:", redemption.txn_hash);
              }
              // Update status in redemptions array
              const redemptionToUpdate = redemptions.find(r => r.txn_hash === redemption.txn_hash);
              if (redemptionToUpdate) {
                redemptionToUpdate.status = REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING;
              }
              //console.log("[processRedemptions] Redemption updated offchain status:", redemption.txn_hash);
            } catch (error) {
              ///const remarks = `Error updating redemption pending yield provider unstake: ${error.message || error}`;
              ///await near.updateRedemptionRemarks(redemption.txn_hash, remarks);
              console.log("[processRedemptions] Error updating redemption pending yield provider unstake:", error.message || error);
              failedUnstakes.push(redemption.txn_hash);
              continue;
            }
          }
          
          // remove failed unstakes from `newRedemptions`
          newRedemptions = newRedemptions.filter(
            (redemption) => !failedUnstakes.includes(redemption.txn_hash)
          );

          const totalNewAbtcAmount = newRedemptions.reduce(
            (sum, record) => sum + record.abtc_amount,
            0,
          );
          totalNewAmount += totalNewAbtcAmount;
          console.log(`Total new abtc amount: ${totalNewAbtcAmount}`);
        }

        // Process bridgings if conditions met  
        if (shouldProcessBridgings) {
          const failedUnstakes = [];

          for (const bridging of newBridgings) {
            try {
              await near.updateBridgingFeesYieldProviderUnstakeProcessing(bridging.txn_hash);
               // Update status in bridgings array
               const bridgingToUpdate = bridgings.find(b => b.txn_hash === bridging.txn_hash);
               if (bridgingToUpdate) {
                 bridgingToUpdate.status = BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING;
               }
            } catch (error) {
              const remarks = `Error updating bridging fees pending yield provider unstake: ${error.message || error}`;
              await near.updateBridgingFeesYieldProviderRemarks(bridging.txn_hash, remarks);
              failedUnstakes.push(bridging.txn_hash);
            }
          }

          // remove failed ones from the list
          newBridgings = newBridgings.filter(
            (bridging) => !failedUnstakes.includes(bridging.txn_hash)
          );

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

        // Update totalNewAmount in withdrawal data
        await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData({
          totalNewAmount: totalNewAmount,
          totalRecords: newRedemptions.length + newBridgings.length
        });

        const newLastUnstakingTime = Date.now();
        // Step 3: Update last unstaking time before processing new unstaking requests
        console.log("New Last Unstaking Time:", newLastUnstakingTime);
        await near.updateLastUnstakingTime(newLastUnstakingTime);
        globalParams.last_unstaking_time = newLastUnstakingTime;
      }
      
    } catch (error) {
      console.error("Error processing new unstaking requests:", error);

    }

  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.ProcessUnstakingAndWithdrawalRunning = false;
  }
}

module.exports = { processUnstakingAndWithdrawal };
