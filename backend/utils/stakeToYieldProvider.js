const { createRelayerClient } = require('@bithive/relayer-api');

const { flagsBatch } = require("./batchFlags");



async function StakeToYieldProvider(near, bitcoinInstance) {
  const batchName = `Batch B StakeToYieldProvider`;

  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.stakeToYieldProviderRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.stakeToYieldProviderRunning = true;
      const { address, publicKey } = await bitcoinInstance.deriveBTCAddress(near);

      const unconfirmedCount = await bitcoinInstance.getPendingOutCount(address);

      if (unconfirmedCount >= 20) {
        console.log("Unconfirmed out going transactions > 20. Skipping this run.");
        return;
      }

      // Get the first valid deposit and associated chain config using near.getFirstValidDepositChainConfig
      const result = await near.getFirstValidUserDeposit();

      console.log("result: ", result);
      // Check if the result is null or undefined
      if (!result) {
        console.log("No valid user deposit or chain config found.");
        return;
      }

      const [btcTxnHash, btcAmount, yieldProviderGasFee, protocolFee, mintingFee] = result;
      try {
        await near.updateDepositPendingYieldProviderDeposit(btcTxnHash);

        // Convert publicKey to a string
        const publicKeyString = publicKey.toString("hex");

        console.log("publicKeyString: ", publicKeyString);
        // 1. Build the PSBT that is ready for signing
        const { psbt: unsignedPsbtHex } = await relayer.deposit.buildUnsignedPsbt({
          publicKey: publicKeyString,
          address,
          amount: Number(btcAmount) - Number(yieldProviderGasFee) - Number(protocolFee) - Number(mintingFee),
          fee: Number(yieldProviderGasFee)
        });

        console.log("unsignedPsbtHex: ", unsignedPsbtHex);
        
        const signedPsbt = await bitcoinInstance.mpcSignPsbt(near,unsignedPsbtHex);

        signedPsbt.finalizeAllInputs();

        const signedPsbtHex = signedPsbt.toHex();

        console.log("signedPsbtHex: ", signedPsbtHex);

         // 3. Submit the finalized PSBT for broadcasting and relaying
        const { txHash } = await relayer.deposit.submitFinalizedPsbt({
          psbt: signedPsbtHex,
          publicKey: publicKeyString,
        });

        console.log("txHash:", txHash);

        console.log("Status updated");

        await near.updateYieldProviderTxnHash(
          btcTxnHash,
          txHash,
        );

        console.log(`${batchName} completed successfully.`);
      } catch (error) {
        let remarks = '';
        console.log("error: ", error);
        // Log the error data if available
        if (error.response && error.response.data.error.message) {
          
          console.log("error.response.data", error.response.data);
          remarks = `Error staking to yield provider: ${JSON.stringify(error.response.data.error.message)}`;
        }
        else {
          remarks = `Error staking to yield provider: ${error} - ${error.reason}`;
        }
        console.error(remarks);
        await near.updateDepositRemarks(btcTxnHash, remarks);
        return;
      }
    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.stakeToYieldProviderRunning = false;
    }
  }
}

async function getBithiveDeposits(publicKey) {
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });
  const deposits = await relayer.user.getDeposits({
    publicKey: publicKey,
  });
  return deposits;
}

module.exports = { StakeToYieldProvider, getBithiveDeposits };
