const bitcoin = require("bitcoinjs-lib");
const ethers = require("ethers");
const { createRelayerClient } = require("@bithive/relayer-api");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function WithdrawFromYieldProvider(
  allRedemptions,
  near,
  bitcoinInstance,
) {
  const batchName = `Batch I WithdrawFromYieldProvider`;
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.WithdrawFromYieldProviderRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.WithdrawFromYieldProviderRunning = true;
      const { REDEMPTION_STATUS } = getConstants(); // Access constants dynamically

      // Filter redemptions that need to be processed
      const filteredTxns = allRedemptions.filter(
        (redemption) =>
          redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKED &&
          redemption.remarks === "",
      );

      const { publicKey, address } = await bitcoinInstance.deriveBTCAddress(near);
      const publicKeyString = publicKey.toString("hex");

      filteredTxns.forEach(async (txn) => {
        try {
          await near.updateRedemptionPendingYieldProviderWithdraw(txn.txn_hash);
          console.log("txn:", txn);
          // Get the account info by public key
          console.log("publicKeyString:", publicKeyString);
          const { account } = await relayer.user.getAccount({
            publicKey: publicKeyString,
          });
          //console.log("account:", account.pendingSignPsbt);
          let partiallySignedPsbtHex = undefined;
          let withdrawnDeposits;
          let _deposits
          
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
            const feeRate = await bitcoinInstance.fetchFeeRate() + 1;
            // 1. Build the PSBT that is ready for signing
            const { psbt: unsignedPsbtHex, deposits: depositsToSign } =
            await relayer.withdraw.buildUnsignedPsbt({
              publicKey: publicKeyString,
              deposits: _deposits,
              amount: txn.abtc_amount,
              recipientAddress: address,
              feeRate: feeRate,
            });
            let partiallySignedPsbt = await bitcoinInstance.mpcSignPsbt(near,unsignedPsbtHex);
            partiallySignedPsbtHex = partiallySignedPsbt.toHex();
            
            withdrawnDeposits = depositsToSign;

            console.log("Patially signed PSBT via MPC:", partiallySignedPsbtHex);
          
          }

          const depositTxHash = withdrawnDeposits[0].txHash;
          
          console.log("depositTxHash:", depositTxHash);
        
          // 3. Sign the PSBT with BitHive NEAR Chain Signatures
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

          // 4. Submit the finalized PSBT for broadcasting and relaying
          const { txHash: yieldProviderWithdrawalTxHash } = await relayer.withdraw.submitFinalizedPsbt({
            psbt: fullySignedPsbt,
          });

          console.log("Withdrawal txHash:", yieldProviderWithdrawalTxHash);

          await near.updateRedemptionYieldProviderWithdrawing(txn.txn_hash, depositTxHash, yieldProviderWithdrawalFee);
          
        } catch (error) {
          let remarks = '';
          // Log the error data if available
          if (error.response && error.response.data.error.message) {
            console.log("error.response.data", error.response.data);
            remarks = `Error withdrawing from yield provider: ${JSON.stringify(error.response.data.error.message)}`;
          }
          else {
            remarks = `Error withdrawing from yield provider: ${error} - ${error.reason}`;
          }
          console.log("Error:", remarks);
          await near.updateRedemptionRemarks(txn.txn_hash, remarks);
          return;
        }
      });
    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.WithdrawFromYieldProviderRunning = false;
    }
  }
}

module.exports = { WithdrawFromYieldProvider };
