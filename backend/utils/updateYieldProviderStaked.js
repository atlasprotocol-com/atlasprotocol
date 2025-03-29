const { createRelayerClient } = require("@bithive/relayer-api");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function UpdateYieldProviderStaked(allDeposits, near, bitcoinInstance) {
  const batchName = `Batch C UpdateYieldProviderStaked`;
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.UpdateYieldProviderStakedRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.UpdateYieldProviderStakedRunning = true;
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
      for (const txn of filteredTxns) {
        try {
          const deposit = deposits.find(
            (d) => d.depositTxHash === txn.yield_provider_txn_hash,
          );

          if (!deposit) {
            throw new Error(
              `Deposit not found in yield provider for txHash: ${txn.yield_provider_txn_hash}`,
            );
          }

          if (deposit.status === DEPOSIT_STATUS.DEPOSIT_FAILED) {
            throw new Error(
              `Yield provider deposit returned failed for txHash: ${txn.yield_provider_txn_hash}`,
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
          console.log(
            "Error updating stake to yield provider deposited:",
            error,
          );
          await near.updateDepositRemarks(txn.btc_txn_hash, error);
        }
      }
    } catch (error) {
      console.log("Error updating stake to yield provider deposited:", error);
    } finally {
      flagsBatch.UpdateYieldProviderStakedRunning = false;
    }
  }
}

module.exports = { UpdateYieldProviderStaked };
