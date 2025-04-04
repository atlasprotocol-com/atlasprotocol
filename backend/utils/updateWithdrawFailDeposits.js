const { getConstants } = require("../constants");
const bitcoin = require("../services/bitcoin");

const { flagsBatch } = require("./batchFlags");

const batchName = `-------------- Batch F UpdateWithdrawFailDeposits`;

async function UpdateWithdrawFailDeposits(allDeposits, near, bitcoin) {
  if (flagsBatch.UpdateWithdrawFailDepositsRunning) {
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

  try {
    const refundingDeposits = allDeposits.filter(
      (d) => d.status === DEPOSIT_STATUS.DEP_BTC_REFUNDING && !!d.refund_txn_id,
    );

    for (let deposit of refundingDeposits) {
      const tx = await bitcoin.fetchTxnByTxnID(deposit.refund_txn_id);
      const confirmed = tx && tx.status && tx.status.confirmed;

      console.log(
        `[${deposit.btc_txn_hash}] withdraw_tx: ${deposit.refund_txn_id} status: ${tx.status.confirmed}`,
      );
      if (confirmed) {
        await near.updateWithdrawFailDepositStatus(
          deposit.btc_txn_hash,
          tx.status.block_time,
        );
      }
    }

    flagsBatch.UpdateWithdrawFailDepositsRunning = true;
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateWithdrawFailDepositsRunning = false;
  }
}

module.exports = { UpdateWithdrawFailDeposits };
