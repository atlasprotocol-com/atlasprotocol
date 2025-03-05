const { getConstants } = require("../constants");
const { globalParams } = require("../config/globalParams");
//const { handleCoboTransaction } = require("./coboIntegration");

const { flagsBatch } = require("./batchFlags");

const batchName = `-------------- Batch F UpdateWithdrawFailDeposits`;

async function UpdateWithdrawFailDeposits(allDeposits, near, bitcoin) {
  if (flagsBatch.UpdateWithdrawFailDepositsRunning) {
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

  try {
    const refundingDeposits = allDeposits.filter(
      (d) => d.status === DEPOSIT_STATUS.DEP_BTC_REFUNDING,
    );

    for (let deposit of refundingDeposits) {
      let btcTxnHash, timestamp, hasConfirmed;

      if (process.env.USE_COBO === "true" && deposit.custody_txn_id !== "") {
        // ({ btcTxnHash, timestamp, hasConfirmed } = await handleCoboTransaction(
        //   deposit.custody_txn_id,
        // ));
      } else {
        // @TODO: implement non COBO integration
      }

      if (btcTxnHash && hasConfirmed) {
        await near.updateWithdrawFailDepositStatus(btcTxnHash, timestamp);
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
