const _ = require("lodash");

const { getBridgingRecordsToUpdateMinted } = require("../helpers/bridgingHelper");
const { getConstants } = require("../constants");
const { updateOffchainBridgingStatus } = require("../helpers/bridgingHelper");

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
    const filteredTxns = await getBridgingRecordsToUpdateMinted(allBridgings);

    console.log(`${batchName} Found ${filteredTxns.length} deposits to process.`);

    // Update status to DEP_ABTC_MINTED_INTO_ATBTC for all deposits
    for (const bridging of filteredTxns) {
      
      console.log('[UpdateBridgingAtbtcMinted] Bridging record:', bridging);
      
      await near.updateBridgingAtbtcMinted(bridging.txn_hash);
      
      await updateOffchainBridgingStatus(
        allBridgings,
        bridging.txn_hash,
        BRIDGING_STATUS.ABTC_MINTED_TO_DEST
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
