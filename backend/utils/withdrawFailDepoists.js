const { getConstants } = require("../constants");
const { globalParams } = require("../config/globalParams");
const { runWithdrawFailDepositCoboIntegration } = require("./coboIntegration");

const { flagsBatch } = require("./batchFlags");

async function WithdrawFailDepoists(allDeposits, near, bitcoin) {
  const batchName = `Batch F WithdrawFailDepoists`;

  if (flagsBatch.WithdrawFailDepoistsRunning) {
    return;
  }

  const { DEPOSIT_STATUS } = getConstants();
  const depositAddress =
    process.env.USE_COBO === "true"
      ? process.env.COBO_DEPOSIT_ADDRESS
      : process.env.BTC_ATLAS_DEPOSIT_ADDRESS;
  if (!depositAddress) {
    console.error(
      "Neither COBO_DEPOSIT_ADDRESS nor BTC_ATLAS_DEPOSIT_ADDRESS is set",
    );
    return;
  }

  flagsBatch.WithdrawFailDepoistsRunning = true;

  try {
    const toBeRefund = allDeposits.filter(
      (d) =>
        d.status === DEPOSIT_STATUS.DEP_BTC_DEPOSITED_INTO_ATLAS &&
        !d.remarks &&
        d.retry_count >= globalParams.maxRetryCount,
    );

    for (const deposit of toBeRefund) {
      const utxos = await bitcoin.fetchUTXOs(depositAddress);
      const result = await near.withdrawFailDepositByBtcTxHash({
        btc_txn_hash: deposit.btc_txn_hash,
        utxos: utxos,
        fee_rate: 0,
      });

      if (process.env.USE_COBO === "true") {
        // If USE_COBO is true, run the Cobo integration logic
        await runWithdrawFailDepositCoboIntegration(result.btc_txn_hash, near);
      } else {
        // Otherwise, run the original logic
        // To be implememted
      }
    }
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.WithdrawFailDepoistsRunning = false;
  }
}

module.exports = { WithdrawFailDepoists };
