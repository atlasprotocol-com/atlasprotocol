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

      // Fetch all deposits once
      const { deposits } = await relayer.user.getDeposits({
        publicKey: publicKeyString,
      });
      console.log("Number of yield provider records:", deposits.length);
      for (let i = 0; i < filteredTxns.length; i++) {
        const txn = filteredTxns[i];
        const deposit = deposits.find(
          (d) => d.depositTxHash === txn.yield_provider_txn_hash,
        );

        if (!deposit) {
          console.log(`[${txn.yield_provider_txn_hash}] ${deposit.status}`);
          continue;
        }

        const ok =
          deposit.status === BITHIVE_STATUS.DEPOSIT_CONFIRMED ||
          deposit.status === BITHIVE_STATUS.DEPOSIT_CONFIRMED_INVALID ||
          deposit.status === BITHIVE_STATUS.WITHDRAW_CONFIRMED;
        if (!ok) {
          console.log(`[${txn.yield_provider_txn_hash}] ${deposit.status}`);
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
