const _ = require("lodash");

const { getChainConfig } = require("../utils/network.chain.config");
const { getConstants } = require("../constants");
const { updateOffchainDepositStatus, updateOffchainDepositRemarks } = require("../helpers/depositsHelper");

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
    const filteredTxns = allDeposits.filter((deposit) => {
      try {
        const chainConfig = getChainConfig(deposit.receiving_chain_id);
        return (
          deposit.status === DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC &&
          deposit.minted_txn_hash !== "" &&
          deposit.remarks === "" &&
          deposit.minted_txn_hash_verified_count >= chainConfig.validators_threshold
        );
      } catch (error) {
        console.log(`Error getting chain config for ${deposit.receiving_chain_id}, skipping record`);
        return false;
      }
    });

      // Update status to DEP_BTC_MINTED_INTO_ABTC for all deposits
      for (const deposit of filteredTxns) {
        await near.updateDepositMinted(
          deposit.btc_txn_hash,
          deposit.minted_txn_hash,
        );
        await updateOffchainDepositStatus(allDeposits, deposit.btc_txn_hash, DEPOSIT_STATUS.BTC_MINTED_INTO_ABTC);
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
