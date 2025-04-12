const btc = require("bitcoinjs-lib");

const { getConstants } = require("../constants");
const { getChainConfig } = require("../utils/network.chain.config");
const WithdrawalFromYieldProviderHelper = require("../helpers/withdrawalFromYieldProviderHelper");

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

    const { REDEMPTION_STATUS } = getConstants();
    
    // Check if ready to send BTC back to users
    const { readySendToUser, sendToUserBtcTxnHash, lastWithdrawalTxHash } = await WithdrawalFromYieldProviderHelper.getLastWithdrawalData();
    
    if (!readySendToUser) {
      console.log("[SendBtcBackToUser] Not ready to send BTC back to users yet");
      return;
    }

    if (sendToUserBtcTxnHash !== '') {
      console.log("[SendBtcBackToUser] BTC already sent back to users");
      return;
    }

    // Get records with BTC_YIELD_PROVIDER_WITHDRAWN status, empty remarks, and meeting threshold
    // First filter records with BTC_YIELD_PROVIDER_WITHDRAWN status
    const withdrawnRecords = redemptions.filter(redemption => {
      try {
        const chainConfig = getChainConfig(redemption.abtc_redemption_chain_id);
        return redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWN &&
          redemption.remarks === "" &&
          redemption.verified_count >= chainConfig.validators_threshold;
      } catch (error) {
        const remarks = `Chain config not found for chain ID: ${redemption.abtc_redemption_chain_id}`;
        near.updateRedemptionRemarks(redemption.txn_hash, remarks);
        return false;
      }
    }).sort((a, b) => a.txn_hash.localeCompare(b.txn_hash));

    // Filter records matching the first yield provider transaction hash
    // Calculate page size based on total records and max descendants
    //const maxBtcDescendants = process.env.MAX_BTC_DESCENDANTS;
    const minBtcTxn = process.env.MIN_BTC_TXN;
    //const pageSize = Math.max(Math.ceil(totalRecords / maxBtcDescendants), minBtcTxn);

    // console.log("[SendBtcBackToUser] Total records:", totalRecords);
    // console.log("[SendBtcBackToUser] Page size:", pageSize);
    // console.log("[SendBtcBackToUser] Withdrawal provider txn hash:", lastWithdrawalTxHash);
    
    // Filter records matching first yield provider txn hash and take pageSize amount
    const recordsForYieldTxn = lastWithdrawalTxHash ? 
      withdrawnRecords
        .filter(record => record.yield_provider_txn_hash === lastWithdrawalTxHash)
        .slice(0, minBtcTxn) 
      : [];

    console.log("[SendBtcBackToUser] Records for yield txn:", recordsForYieldTxn);
    console.log("[SendBtcBackToUser] Records for yield txn length:", recordsForYieldTxn.length);
    if (recordsForYieldTxn.length === 0) {
      console.log("[SendBtcBackToUser] No records found to process");
      await WithdrawalFromYieldProviderHelper.clearLastWithdrawalData();
      return;
    }

    // Write txn_hash records using helper
    try {
      const records = recordsForYieldTxn.map(record => ({
        txn_hash: record.txn_hash,
        btc_receiving_address: record.btc_receiving_address,
        amount: record.abtc_amount - record.btc_redemption_fee - record.yield_provider_gas_fee - record.protocol_fee
      }));
      await WithdrawalFromYieldProviderHelper.writeRecordsToFile(records);
    } catch (error) {
      console.error('[SendBtcBackToUser] Error writing txn_hash records:', error);
    }

    await processSendBtcBackToUser(near, recordsForYieldTxn, bitcoinInstance, lastWithdrawalTxHash);

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error in ${batchName}:`, error);
  } finally {
    flagsBatch.SendBtcBackToUserRunning = false;
  }
}

// Helper function to process a batch of redemption transactions
async function processSendBtcBackToUser(near, redemptionsToProcess, bitcoinInstance, lastWithdrawalTxHash) {
  try {
    const txnHashes = redemptionsToProcess.map(
      (redemption) => redemption.txn_hash,
    );

    const { address, publicKey } = await bitcoinInstance.deriveBTCAddress(near);
    console.log(`BTC sender address: ${address}`);

    try {
      // Create payload only once
      const payload = await bitcoinInstance.createPayload(
        near,
        address,
        txnHashes,
        lastWithdrawalTxHash,
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
      const relayedtxHash =
        await bitcoinInstance.relayTransaction(signedTransaction);
      console.log("Relayed tx hash:", relayedtxHash);

      await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData({
        sendToUserBtcTxnHash: relayedtxHash,
      });

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
