const bitcoin = require("bitcoinjs-lib");
const ethers = require("ethers");
const { createRelayerClient } = require("@bithive/relayer-api");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function WithdrawBridgingFeesFromYieldProvider(
  near,
  bitcoinInstance,
  atlasTreasuryAddress
) {
  const batchName = `Batch WithdrawBridgingFeesFromYieldProvider`;
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.WithdrawBridgingFeesFromYieldProviderRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.WithdrawBridgingFeesFromYieldProviderRunning = true;

      // Get first valid bridging fees unstake
      const txn = await near.getFirstValidBridgingFeesUnstaked();
      if (!txn) {
        return;
      }

      const [txn_hash, abtc_amount, minting_fee_sat, protocol_fee, yield_provider_gas_fee] = txn;
      console.log("abtc_amount:", abtc_amount);
      console.log("txn_hash:", txn_hash); 
      console.log("minting_fee_sat:", minting_fee_sat);
      console.log("protocol_fee:", protocol_fee);
      console.log("yield_provider_gas_fee:", yield_provider_gas_fee);

      const { publicKey, address } = await bitcoinInstance.deriveBTCAddress(near);
      const publicKeyString = publicKey.toString("hex");

      try {
        await near.updateBridgingFeesPendingYieldProviderWithdraw(txn_hash);

        // Get the account info by public key
        console.log("publicKeyString:", publicKeyString);
        const { account } = await relayer.user.getAccount({
          publicKey: publicKeyString,
        });

        let partiallySignedPsbtHex = undefined;
        let withdrawnDeposits;
        let _deposits;

        console.log("account:", account);
        
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
          
          const amountToWithdraw = minting_fee_sat + protocol_fee + yield_provider_gas_fee;
          console.log("amountToWithdraw:", amountToWithdraw);
          // 1. Build the PSBT that is ready for signing
          const { psbt: unsignedPsbtHex, deposits: depositsToSign } =
          await relayer.withdraw.buildUnsignedPsbt({
            publicKey: publicKeyString,
            deposits: _deposits,
            amount: amountToWithdraw,
            recipientAddress: atlasTreasuryAddress,
            fee: yield_provider_gas_fee,
          });
          console.log("unsignedPsbtHex:", unsignedPsbtHex);
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

        // 4. Submit the finalized PSBT for broadcasting and relaying
        const { txHash: yieldProviderWithdrawalTxHash } = await relayer.withdraw.submitFinalizedPsbt({
          psbt: fullySignedPsbt,
        });

        console.log("Withdrawal txHash:", yieldProviderWithdrawalTxHash);

        await near.updateBridgingFeesYieldProviderWithdrawing(txn_hash, depositTxHash);
        
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
        await near.updateBridgingFeesYieldProviderRemarks(txn_hash, remarks);
        return;
      }
    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.WithdrawBridgingFeesFromYieldProviderRunning = false;
    }
  }
}

module.exports = { WithdrawBridgingFeesFromYieldProvider };
