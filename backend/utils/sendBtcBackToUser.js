const btc = require("bitcoinjs-lib");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function SendBtcBackToUser(near, bitcoinInstance) {
  const batchName = `Batch H SendBtcBackToUser`;
  const { NETWORK_TYPE } = getConstants();

  // Check if a previous batch is still running
  if (flagsBatch.SendBtcBackToUserRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run...`);
    flagsBatch.SendBtcBackToUserRunning = true;

    // Filter eligible redemptions
    const txn_hash = await near.getFirstValidRedemption();

    if (txn_hash) {
        // Otherwise, run the original logic
        await processRedemption(txn_hash, near, bitcoinInstance);
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error in ${batchName}:`, error);
  } finally {
    flagsBatch.SendBtcBackToUserRunning = false;
  }
}

// Helper function to process a single redemption transaction
async function processRedemption(txn_hash, near, bitcoinInstance) {
  try {
    console.log(`\nProcessing txns for txn hash: ${txn_hash}`);

    const { address, publicKey } = await bitcoinInstance.deriveBTCAddress(near);
    // Derive BTC address
    console.log(`BTC sender address: ${address}`);

    // Create payload only once
    const payload = await bitcoinInstance.createPayload(near, address, txn_hash);

    console.log("payload", payload);

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
      txn_hash,
    );

    console.log("Signed Transaction:", signedTransaction);

    // Relay the signed transaction
    const relayedtxHash = await bitcoinInstance.relayTransaction(signedTransaction);

    await near.updateRedemptionPendingBtcMempool(txn_hash, relayedtxHash, payload.estimatedFee, payload.protocolFee);

    console.log(`Sent BTC back to user for txn hash: ${txn_hash}`);
  } catch (error) {
    console.error(`Error processing txn with hash ${txn_hash}:`, error);
    await near.updateRedemptionRemarks(
      txn_hash,
      `Error processing txn: ${error.message} - ${error.reason}`,
    );
  }
}

module.exports = { SendBtcBackToUser };