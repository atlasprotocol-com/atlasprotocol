const { createRelayerClient } = require('@bithive/relayer-api');

const { flagsBatch } = require("./batchFlags");

async function UnStakeFromYieldProvider(near, bitcoinInstance) {
  const batchName = `Batch G UnStakeFromYieldProvider`;
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.UnStakeFromYieldProviderRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.UnStakeFromYieldProviderRunning = true;

      // Get the first valid deposit and associated chain config using near.getFirstValidDepositChainConfig
      const result = await near.getFirstValidUserRedemption();

      // Check if the result is null or undefined
      if (!result) {
        console.log("No valid user deposit or chain config found.");
        return;
      }
      console.log("result:", result);
      
      const [txnHash, abtcAmount] = result;

      try {
        await near.updateRedemptionPendingYieldProviderUnstake(
          txnHash,
        );
        
        const { publicKey } =
          await bitcoinInstance.deriveBTCAddress(near);

        // Convert publicKey to a string
        const publicKeyString = publicKey.toString("hex");

        let _deposits;

        // 1. Build the unstake message that is ready for signing
        const { message } = await relayer.unstake.buildUnsignedMessage({
          deposits: _deposits,
          amount: abtcAmount,
          publicKey: publicKeyString,
        });

        console.log("message:", message);
        
        // 2. MPC sign the message
        let signature = await bitcoinInstance.mpcSignMessage(near, message);

        console.log("signature:", signature);

        // 3. Submit the signature
        await relayer.unstake.submitSignature({
          deposits: _deposits,
          amount: abtcAmount,
          publicKey: publicKeyString,
          signature: signature.toString('hex'),
        });

        console.log("signature submitted");

        console.log(`${batchName} completed successfully.`);

        await near.updateRedemptionYieldProviderUnstakeProcessing(txnHash);

      } catch (error) {
        let remarks = '';

        // Log the error data if available
        if (error.response && error.response.data.error.message) {
          remarks = `Error unstaking from yield provider: ${JSON.stringify(error.response.data.error)}`;
          
        }
        else {
          remarks = `Error unstaking from yield provider: ${error} - ${error.reason}`;
        }
        console.error(remarks);
        await near.updateRedemptionRemarks(txnHash, remarks);

        return;
      }
    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.UnStakeFromYieldProviderRunning = false;
    }
  }
}

module.exports = { UnStakeFromYieldProvider };
