const { createRelayerClient } = require("@bithive/relayer-api");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function UpdateYieldProviderStacked(allDeposits, near, bitcoinInstance) {
  const batchName = `Batch C UpdateYieldProviderStacked`;
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.UpdateYieldProviderStackedRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.UpdateYieldProviderStackedRunning = true;
      const { DEPOSIT_STATUS, BITHIVE_STATUS } = getConstants(); // Access constants dynamically

      const { publicKey } = await bitcoinInstance.deriveBTCAddress(near);

      const publicKeyString = publicKey.toString("hex");

      // Filter deposits that need to be processed
      const filteredTxns = allDeposits.filter(
        (deposit) =>
          deposit.status ===
            DEPOSIT_STATUS.BTC_PENDING_YIELD_PROVIDER_DEPOSIT &&
          deposit.yield_provider_txn_hash !== "" &&
          deposit.remarks === "",
      );

     

      for (let i = 0; i < filteredTxns.length; i++) {
        const txn = filteredTxns[i];
        const { deposit } = await relayer.user.getDeposit({
          publicKey: publicKeyString,
          txHash: txn.yield_provider_txn_hash,
        });
        console.log("deposit: ", deposit);
        if (!deposit) {
          console.log(
            `Deposit not found for txHash: ${txn.yield_provider_txn_hash}`,
          );
          continue;
        }

        const ok =
          deposit.status === BITHIVE_STATUS.DEPOSIT_CONFIRMED ||
          deposit.status === BITHIVE_STATUS.DEPOSIT_CONFIRMED_INVALID ||
          deposit.status === BITHIVE_STATUS.WITHDRAW_CONFIRMED;
        if (!ok) {
          console.log(
            `Deposit status ${deposit.status} of txHash: ${txn.yield_provider_txn_hash} is not valid`,
          );
          continue;
        }
        await near.updateDepositYieldProviderDeposited(txn.btc_txn_hash);
      }
    } catch (error) {
      console.log("Error updating stake to yield provider deposited:", error);
    } finally {
      flagsBatch.UpdateYieldProviderStackedRunning = false;
    }
  }
}

module.exports = { UpdateYieldProviderStacked };
