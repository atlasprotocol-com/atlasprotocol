const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function UpdateYieldProviderStaked(allDeposits, bithiveRecords, near) {
  const batchName = `Batch C UpdateYieldProviderStaked`;
  
  // Check if a previous batch is still running
  if (flagsBatch.UpdateYieldProviderStakedRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.UpdateYieldProviderStakedRunning = true;
      const { DEPOSIT_STATUS, BITHIVE_STATUS } = getConstants(); // Access constants dynamically

      // Filter deposits that need to be processed
      const filteredTxns = allDeposits.filter(
        (deposit) =>
          deposit.status ===
            DEPOSIT_STATUS.BTC_PENDING_YIELD_PROVIDER_DEPOSIT &&
          deposit.yield_provider_txn_hash !== "" &&
          deposit.remarks === "",
      );

      console.log("filteredTxns: ", filteredTxns.length);
      const relevantBithiveRecords = bithiveRecords.filter(record => 
        filteredTxns.some(txn => txn.yield_provider_txn_hash === record.depositTxHash)
      );
      console.log("Relevant bithiveRecords: ", relevantBithiveRecords.length);

      for (const txn of filteredTxns) {
        try {
          
          // const deposit = await near.getDepositByBtcTxnHash(txn.btc_txn_hash);

          // // Another check to ensure the onchain deposit is in the correct status
          // if (deposit.status !== DEPOSIT_STATUS.BTC_PENDING_YIELD_PROVIDER_DEPOSIT) {
          //   continue;
          // }

          const bithiveDeposit = relevantBithiveRecords.find(
            (d) => d.depositTxHash === txn.yield_provider_txn_hash,
          );

          if (!bithiveDeposit) {
            console.log("bithiveDeposit not found for txn: ", txn);
            return;
          }

          if (bithiveDeposit.status === BITHIVE_STATUS.DEPOSIT_FAILED) {
            throw new Error(
              `Yield provider returned failed deposit`,
            );
          }

          const ok =
            deposit.status === BITHIVE_STATUS.DEPOSIT_CONFIRMED ||
            deposit.status === BITHIVE_STATUS.DEPOSIT_CONFIRMED_INVALID ||
            deposit.status === BITHIVE_STATUS.WITHDRAW_CONFIRMED;
          if (!ok) {
            continue;
          }

          await near.updateDepositYieldProviderDeposited(txn.btc_txn_hash);
        } catch (error) {
          let remarks = error.toString();
          console.log(
            "Error updating stake to yield provider deposited:",
            remarks,
          );
          await near.updateDepositRemarks(txn.btc_txn_hash, remarks.toString());
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
