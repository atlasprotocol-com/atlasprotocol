const { createRelayerClient } = require('@bithive/relayer-api');

const { flagsBatch } = require("./batchFlags");

async function UnstakeBridgingFeesFromYieldProvider(near, bitcoinInstance) {
  const batchName = `Batch G UnstakeBridgingFeesFromYieldProvider`;
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.UnstakeBridgingFeesFromYieldProviderRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.UnstakeBridgingFeesFromYieldProviderRunning = true;

      // Get the first valid bridging fees to unstake
      const result = await near.getFirstValidBridgingFeesUnstake();

      // Check if the result is null or undefined
      if (!result) {
        console.log("No valid bridging fees found to unstake.");
        return;
      }
      console.log("result:", result);
      
      const [txn_hash, abtc_amount, minting_fee_sat, protocol_fee, yield_provider_gas_fee] = result;
      const amountToWithdraw = minting_fee_sat + protocol_fee + yield_provider_gas_fee;

      console.log("abtc_amount:", abtc_amount);
      console.log("txn_hash:", txn_hash); 
      console.log("minting_fee_sat:", minting_fee_sat);
      console.log("protocol_fee:", protocol_fee);
      console.log("yield_provider_gas_fee:", yield_provider_gas_fee);

      try {
        await near.updateBridgingFeesPendingYieldProviderUnstake(
          txn_hash,
        );
        
        const { publicKey } =
          await bitcoinInstance.deriveBTCAddress(near);

        // Convert publicKey to a string
        const publicKeyString = publicKey.toString("hex");

        let _deposits;
        // 1. Build the unstake message that is ready for signing
        const { message } = await relayer.unstake.buildUnsignedMessage({
          deposits: _deposits,
          amount: amountToWithdraw,
          publicKey: publicKeyString,
        });

        console.log("message:", message);
        
        // 2. MPC sign the message
        let signature = await bitcoinInstance.mpcSignMessage(near, message);

        console.log("signature:", signature);

        // 3. Submit the signature
        await relayer.unstake.submitSignature({
          deposits: _deposits,
          amount: amountToWithdraw,
          publicKey: publicKeyString,
          signature: signature.toString('hex'),
        });

        console.log("signature submitted");

        console.log(`${batchName} completed successfully.`);

        await near.updateBridgingFeesYieldProviderUnstakeProcessing(txn_hash);

      } catch (error) {
        let remarks = '';

        // Log the error data if available
        if (error.response && error.response.data.error.message) {
          remarks = `Error unstaking bridging fees from yield provider: ${JSON.stringify(error.response.data.error)}`;
          
        }
        else {
          remarks = `Error unstaking bridging fees from yield provider: ${error} - ${error.reason}`;
        }
        console.error(remarks);
        await near.updateBridgingFeesYieldProviderRemarks(txn_hash, remarks);

        return;
      }
    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.UnstakeBridgingFeesFromYieldProviderRunning = false;
    }
  }
}

module.exports = { UnstakeBridgingFeesFromYieldProvider };
