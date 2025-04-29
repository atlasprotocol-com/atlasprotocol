const _ = require("lodash");

const { getChainConfig } = require("../utils/network.chain.config");
const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function UpdateBridgingAtbtcMinted(allBridgings, near) {
  const batchName = `Batch M UpdateBridgingAtbtcMinted`;

  // Check if the batch is already running
  if (flagsBatch.UpdateBridgingAtbtcMintedRunning) {
    console.log(`Previous ${batchName} incomplete. Will skip this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateBridgingAtbtcMintedRunning = true;

    const { BRIDGING_STATUS } = getConstants();

    // Filter deposits that need to be processed
    const filteredTxns = allBridgings.filter((bridging) => {
      try {
        const chainConfig = getChainConfig(bridging.dest_chain_id);
        return (
          bridging.status === BRIDGING_STATUS.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST &&
          bridging.minted_txn_hash !== "" &&
          bridging.remarks === "" &&
          bridging.minted_txn_hash_verified_count >= chainConfig.validators_threshold
        );
      } catch (error) {
        console.log(`Error getting chain config for ${bridging.dest_chain_id}, skipping record`);
        return false;
      }
    });

    // Update status to DEP_ABTC_MINTED_INTO_ATBTC for all deposits
    for (const bridging of filteredTxns) {
      await near.updateBridgingAtbtcMinted(
        bridging.txn_hash
      );
      console.log(
        `Updated bridging status to DEP_ABTC_MINTED_INTO_ATBTC for txn_hash: ${bridging.txn_hash}`,
      );
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateBridgingAtbtcMintedRunning = false;
  }
}

module.exports = { UpdateBridgingAtbtcMinted };
