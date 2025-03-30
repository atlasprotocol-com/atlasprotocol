const btc = require("bitcoinjs-lib");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function SendBtcBackToUser(near, bitcoinInstance, batchSize = 10) {
  const batchName = `Batch H SendBtcBackToUser`;

  // Check if a previous batch is still running
  if (flagsBatch.SendBtcBackToUserRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run... Processing ${batchSize} records`);
    flagsBatch.SendBtcBackToUserRunning = true;
    
    await processSendBtcBackToUser(near, bitcoinInstance, batchSize);

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error in ${batchName}:`, error);
  } finally {
    flagsBatch.SendBtcBackToUserRunning = false;
  }
}

// Helper function to process a batch of redemption transactions
async function processSendBtcBackToUser(near, bitcoinInstance, batchSize) {
  try {
    // Get batch of records to process
    const redemptions = await near.getRedemptionsToSendBtc(batchSize);
    
    if (!redemptions || redemptions.length === 0) {
      console.log("No redemptions to process");
      return;
    }

    console.log(`Processing ${redemptions.length} redemptions`);
    const txnHashes = redemptions.map(redemption => redemption.txn_hash);
    console.log('Transaction hashes to process:', txnHashes);

    const { address, publicKey } = await bitcoinInstance.deriveBTCAddress(near);
    console.log(`BTC sender address: ${address}`);

      try {
        // Create payload only once
        const payload = await bitcoinInstance.createPayload(near, address, txnHashes);

        // Create the PSBT from the base64 payload and add UTXOs
        const psbt = btc.Psbt.fromBase64(payload.psbt);

        await bitcoinInstance.addUtxosToPsbt(psbt, payload.utxos);

        // Update the payload with the new PSBT
        const updatedPayload = {
          ...payload,
          psbt: psbt,
        };

        // Request MPC signature and relay the transaction
        const signedTransaction = await bitcoinInstance.requestSignatureToMPC(
          near,
          updatedPayload,
          publicKey,
        );

        console.log("Signed Transaction:", signedTransaction);
        
        // Relay the signed transaction
        const relayedtxHash = await bitcoinInstance.relayTransaction(signedTransaction);
        console.log("Relayed tx hash:", relayedtxHash);

    
        await near.updateRedemptionPendingBtcMempool(txnHashes, relayedtxHash);
      

        console.log(`Sent BTC back to user for txn hash: ${txnHashes}`);
      } catch (error) {
        console.error(`Error sending BTC back to user:`, error);
        for (const txnHash of txnHashes) {
          await near.updateRedemptionRemarks(
            txnHash,
            `Error processing txn: ${error.message} - ${error.reason}`,
          );
        }
      }
  } catch (error) {
    console.error("Error in processSendBtcBackToUser:", error);
    throw error;
  }
}

module.exports = { SendBtcBackToUser };