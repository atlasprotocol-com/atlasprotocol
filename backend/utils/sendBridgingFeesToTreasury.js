const btc = require("bitcoinjs-lib");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function SendBridgingFeesToTreasury(near, bitcoinInstance, batchSize = 10) {
  const batchName = `Batch L SendBridgingFeesToTreasury`;

  // Check if a previous batch is still running
  if (flagsBatch.SendBridgingFeesToTreasuryRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run...`);
    flagsBatch.SendBridgingFeesToTreasuryRunning = true;
    
    await processSendBridgingFeesToTreasury(near, bitcoinInstance);

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error in ${batchName}:`, error);
  } finally {
    flagsBatch.SendBridgingFeesToTreasuryRunning = false;
  }
}

// Helper function to process sending bridging fees to treasury
async function processSendBridgingFeesToTreasury(near, bitcoinInstance) {
  try {
    // Get BTC sender address and public key
    const { address, publicKey } = await bitcoinInstance.deriveBTCAddress(near);
    console.log(`BTC sender address: ${address}`);
    
    let txnHashes = [];

    try {
      const bridgingRecords = await near.getBridgingRecordsToSendBtc();
      
      console.log("bridgingRecords:", bridgingRecords);
      
      if (!bridgingRecords || bridgingRecords.length < Number(process.env.MIN_BRIDGING_RECORDS_TO_SEND_BTC)) {
        console.log("No bridging records found or not enough records to process");
        return;
      }

      txnHashes = bridgingRecords.map(bridgingRecord => bridgingRecord.txn_hash);
      console.log('Transaction hashes to process:', txnHashes);

      // Create payload for sending fees to treasury
      const transaction = await bitcoinInstance.createSendBridgingFeesTransaction(near, address);

      console.log("transaction:", transaction);

      // If no payload returned or empty PSBT, no eligible transactions to process
      if (!transaction || !transaction.psbt) {
        console.log("No eligible bridging fees to send to treasury");
        return;
      }

      console.log("Created payload for sending fees to treasury");

      txnHashes = transaction.txnHashes;
      // Create the PSBT from the base64 payload and add UTXOs
      const psbt = btc.Psbt.fromBase64(transaction.psbt);
      await bitcoinInstance.addUtxosToPsbt(psbt, transaction.utxos);

      // Update the payload with the new PSBT
      const updatedPayload = {
        ...transaction,
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
      const relayedTxHash = await bitcoinInstance.relayTransaction(signedTransaction);
      console.log("Relayed tx hash:", relayedTxHash);
      

      await near.updateBridgingSendingFeeToTreasury(txnHashes, relayedTxHash);

      console.log(`Successfully sent bridging fees to treasury. Transaction hash: ${relayedTxHash}`);
    } catch (error) {
      console.error(`Error sending bridging fees to treasury:`, error);
      for (const txnHash of txnHashes) {
        await near.updateBridgingFeesYieldProviderRemarks(txnHash, `Error sending bridging fees to treasury: ${error.message} - ${error.reason}`);
      }

      throw error;
    }
  } catch (error) {
    console.error("Error in processSendBridgingFeesToTreasury:", error);
    throw error;
  }
}

module.exports = { SendBridgingFeesToTreasury };