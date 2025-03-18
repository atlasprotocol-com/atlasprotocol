const _ = require("lodash");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasAbtcMinted(allDeposits, near) {
  const batchName = `Batch J UpdateAtlasAbtcMinted`;

  // Check if the batch is already running
  if (flagsBatch.UpdateAtlasAbtcMintedRunning) {
    console.log(`Previous ${batchName} incomplete. Will skip this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasAbtcMintedRunning = true;

    const { DEPOSIT_STATUS } = getConstants(); // Access constants dynamically

    // Filter deposits that need to be processed
    const filteredTxns = allDeposits.filter(
      (deposit) =>
        deposit.status === DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC &&
        deposit.minted_txn_hash !== "" &&
        deposit.remarks === "",
    );

      // Update status to DEP_BTC_MINTED_INTO_ABTC for all deposits
      for (const deposit of filteredTxns) {
        await near.updateDepositMinted(
          deposit.btc_txn_hash,
          deposit.minted_txn_hash,
        );
        console.log(
          `Updated deposit status to DEP_BTC_MINTED_INTO_ABTC for btc_txn_hash: ${deposit.btc_txn_hash} with minted_txn_hash: ${deposit.minted_txn_hash}`,
        );
      }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasAbtcMintedRunning = false;
  }
}

module.exports = { UpdateAtlasAbtcMinted };
