const btc = require("bitcoinjs-lib");

const { getChainConfig } = require("../utils/network.chain.config");
const { getWithdrawRedemptions } = require("../helpers/redemptionHelper");
const { getConstants } = require("../constants");
const redemptionHelper = require("../helpers/redemptionHelper");

const { flagsBatch } = require("./batchFlags");

async function SendBtcBackToUser(near, redemptions, bitcoinInstance) {
  const batchName = `Batch I SendBtcBackToUser`;

  // Check if a previous batch is still running
  if (flagsBatch.SendBtcBackToUserRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run...`);
    flagsBatch.SendBtcBackToUserRunning = true;

    const withdrawnRecords = getWithdrawRedemptions(redemptions);

    if (withdrawnRecords.length === 0) {
      console.log(`${batchName} No records to process.`);
      return;
    }
    
    
    console.log(withdrawnRecords);
    console.log(`${batchName} Found ${withdrawnRecords.length} records to process.`);
    
    for (const redemption of withdrawnRecords) {
      const withdrawalTxHash = redemption.yield_provider_txn_hash;
      await processSendBtcBackToUser(near, [redemption], bitcoinInstance, withdrawalTxHash);
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error in ${batchName}:`, error);
  } finally {
    flagsBatch.SendBtcBackToUserRunning = false;
  }
}

// Helper function to process a batch of redemption transactions
async function processSendBtcBackToUser(near, redemptionsToProcess, bitcoinInstance, withdrawalTxHash) {
  try {
    const { REDEMPTION_STATUS } = getConstants();
    const txnHashes = redemptionsToProcess
      .map((redemption) => redemption.txn_hash)
      .sort();

    const { address, publicKey } = await bitcoinInstance.deriveBTCAddress(near);
    console.log(`BTC sender address: ${address}`);

    console.log(txnHashes);
    
    // Check if withdrawal transaction is already spent
    const status = await bitcoinInstance.fetchTxSpentByTxnID(withdrawalTxHash, address);
    if (status.spent) {
      console.log(`Withdrawal transaction ${withdrawalTxHash} is already spent. Skipping processing.`);
      await near.updateRedemptionPendingBtcMempool(redemptionsToProcess[0].txn_hash, status.txid);
      redemptionHelper.updateOffchainRedemptionStatus(redemptionsToProcess, redemptionsToProcess[0].txn_hash, REDEMPTION_STATUS.BTC_PENDING_MEMPOOL_CONFIRMATION);
      return;
    }

    try {
      // Create payload only once
      const payload = await bitcoinInstance.createPayload(
        near,
        address,
        txnHashes,
        withdrawalTxHash,
        true,
      );

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
      near.updateRedemptionYieldProviderRemarks(redemptionsToProcess[0].txn_hash, `Relayed tx hash: ${relayedtxHash}`);
      console.log("Relayed tx hash:", relayedtxHash);

      await near.updateRedemptionPendingBtcMempool(redemptionsToProcess[0].txn_hash, relayedtxHash);

    } catch (error) {
      console.error("Error in processSendBtcBackToUser:", error);
      throw error;
    }
      
  } catch (error) {
    console.error("Error in SendBtcBackToUser:", error);
    throw error;
  } finally {
    flagsBatch.SendBtcBackToUserRunning = false;
  }
}

module.exports = { SendBtcBackToUser };
