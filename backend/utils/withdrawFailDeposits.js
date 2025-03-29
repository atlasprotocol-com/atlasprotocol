const { getConstants } = require("../constants");
const { globalParams } = require("../config/globalParams");
const bitcoinlib = require("bitcoinjs-lib");

const { flagsBatch } = require("./batchFlags");

const batchName = `-------------- Batch E WithdrawFailDeposits`;

async function WithdrawFailDeposits(allDeposits, near, bitcoin) {
  if (flagsBatch.WithdrawFailDepositsRunning) {
    return;
  }
  console.log(`${batchName}. Start run ...`);

  const { DEPOSIT_STATUS } = getConstants();
  const depositAddress = process.env.BTC_ATLAS_DEPOSIT_ADDRESS;
  if (!depositAddress) {
    console.error(
      "Neither COBO_DEPOSIT_ADDRESS nor BTC_ATLAS_DEPOSIT_ADDRESS is set",
    );
    return;
  }

  flagsBatch.WithdrawFailDepositsRunning = true;

  try {
    const refundingStatuses = [
      DEPOSIT_STATUS.BTC_DEPOSITED_INTO_ATLAS,
      DEPOSIT_STATUS.BTC_PENDING_YIELD_PROVIDER_DEPOSIT,
    ];
    const toBeRefund = allDeposits.filter(
      (d) =>
        refundingStatuses.includes(d.status) &&
        d.remarks &&
        d.retry_count >= globalParams.maxRetryCount,
    );

    for (const deposit of toBeRefund) {
      console.log(
        `${batchName}: ${deposit.btc_txn_hash} retry_count:${deposit.retry_count}`,
      );

      const utxos = await bitcoin.fetchUTXOs(depositAddress);
      const result = await near.withdrawFailDepositByBtcTxHash({
        btc_txn_hash: deposit.btc_txn_hash,
        utxos: utxos,
        fee_rate: await bitcoin.fetchFeeRate(),
      });

      console.log(`WithdrawFailDeposits: ${result.btc_txn_hash}`);
      await runWithdrawFailDepositIntegration(near, bitcoin, result);
    }
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.WithdrawFailDepositsRunning = false;
  }
}

// Helper function to process a single redemption transaction
async function runWithdrawFailDepositIntegration(near, bitcoin, result) {
  try {
    // Derive BTC address
    const { address, publicKey } = await bitcoin.deriveBTCAddress(near);
    console.log(`[${result.btc_txn_hash}] Derived BTC address: ${address}`);

    // Create the PSBT from the base64 payload and add UTXOs
    const psbt = bitcoinlib.Psbt.fromBase64(result.psbt);
    await bitcoin.addUtxosToPsbt(psbt, result.utxos);

    // Update the payload with the new PSBT
    const payload = { ...result, psbt: psbt };

    // Request MPC signature and relay the transaction
    const signedTransaction = await bitcoin.requestSignatureToMPC(
      near,
      payload,
      publicKey,
    );

    // Relay the signed transaction
    const relayedTxHash =
      await await bitcoin.relayTransaction(signedTransaction);

    console.log("------------------------------------");
    console.log(JSON.stringify(result, null, 2));
    console.log(relayedTxHash);
    console.log("------------------------------------");
    await near.updateDepositCustodyTxnId(result.btc_txn_hash, relayedTxHash);
  } catch (error) {
    console.error(`Error ${result.btc_txn_hash}:`, error);
    await near.updateDepositRemarks(
      result.btc_txn_hash,
      `Unable to run withdraw fail deposit: ${error.message}`,
    );
  }
}

module.exports = { WithdrawFailDeposits };
