const { getConstants } = require("../constants");
const { globalParams } = require("../config/globalParams");
//const { runWithdrawFailDepositCoboIntegration } = require("./coboIntegration");

const { flagsBatch } = require("./batchFlags");

const batchName = `-------------- Batch E WithdrawFailDeposits`;

async function WithdrawFailDeposits(allDeposits, near, bitcoin) {
  if (flagsBatch.WithdrawFailDepositsRunning) {
    return;
  }
  console.log(`${batchName}. Start run ...`);

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

  flagsBatch.WithdrawFailDepositsRunning = true;

  try {
    const toBeRefund = allDeposits.filter(
      (d) =>
        d.status === DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC &&
        d.remarks &&
        d.retry_count >= globalParams.maxRetryCount,
    );

    for (const deposit of toBeRefund) {
      console.log(
        `${batchName}: ${deposit.btc_txn_hash} retry_count:${deposit.retry_count}`,
      );

      if (process.env.USE_COBO === "true") {
        const utxos = await bitcoin.fetchUTXOs(depositAddress);
        const result = await near.withdrawFailDepositByBtcTxHash({
          btc_txn_hash: deposit.btc_txn_hash,
          utxos: utxos,
          fee_rate: 0,
        });
        // If USE_COBO is true, run the Cobo integration logic
        //await runWithdrawFailDepositCoboIntegration(result.btc_txn_hash, near);
      } else {
        // Otherwise, run the original logic
        // To be implememted
      }
    }
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.WithdrawFailDepositsRunning = false;
  }
}

module.exports = { WithdrawFailDeposits };
