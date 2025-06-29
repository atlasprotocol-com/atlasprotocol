const { getConstants } = require("../constants");
const {
  updateOffchainDepositStatus,
  updateOffchainDepositRemarks,
  getDepositsToUpdateYieldProviderDeposited,
} = require("../helpers/depositsHelper");

const { flagsBatch } = require("./batchFlags");

async function UpdateYieldProviderStaked(allDeposits, bithiveRecords, near) {
  const batchName = `Batch D UpdateYieldProviderStaked`;

  // Check if a previous batch is still running
  if (flagsBatch.UpdateYieldProviderStakedRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.UpdateYieldProviderStakedRunning = true;
      const { DEPOSIT_STATUS, BITHIVE_STATUS } = getConstants(); // Access constants dynamically

      const filteredTxns =
        await getDepositsToUpdateYieldProviderDeposited(allDeposits);
      console.log("filteredTxns: ", filteredTxns);
      const relevantBithiveRecords = bithiveRecords.filter((record) =>
        filteredTxns.some(
          (txn) => txn.yield_provider_txn_hash === record.depositTxHash,
        ),
      );

      for (const txn of filteredTxns) {
        try {
          const bithiveDeposit = relevantBithiveRecords.find(
            (d) => d.depositTxHash === txn.yield_provider_txn_hash,
          );

          if (!bithiveDeposit) {
            continue;
          }

          if (bithiveDeposit.status === BITHIVE_STATUS.DEPOSIT_FAILED) {
            throw new Error(`Yield provider returned failed deposit`);
          }

          const ok =
            bithiveDeposit.status === BITHIVE_STATUS.DEPOSIT_CONFIRMED ||
            bithiveDeposit.status ===
              BITHIVE_STATUS.DEPOSIT_CONFIRMED_INVALID ||
            bithiveDeposit.status === BITHIVE_STATUS.WITHDRAW_CONFIRMED;
          if (!ok) {
            continue;
          }

          await near.updateDepositYieldProviderDeposited(txn.btc_txn_hash);
          await updateOffchainDepositStatus(
            allDeposits,
            txn.btc_txn_hash,
            DEPOSIT_STATUS.BTC_YIELD_PROVIDER_DEPOSITED,
          );
        } catch (error) {
          let remarks = error.toString();
          console.log(
            "Error updating stake to yield provider deposited:",
            remarks,
          );
          await near.updateDepositRemarks(txn.btc_txn_hash, remarks.toString());
          await updateOffchainDepositRemarks(
            allDeposits,
            txn.btc_txn_hash,
            remarks.toString(),
          );
        }
      }
    } catch (error) {
      console.log("Error updating stake to yield provider deposited:", error);
    } finally {
      console.log(`${batchName}. Completed run...`);
      flagsBatch.UpdateYieldProviderStakedRunning = false;
    }
  }
}

module.exports = { UpdateYieldProviderStaked };
