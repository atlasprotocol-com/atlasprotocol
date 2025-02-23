const { createRelayerClient } = require('@bithive/relayer-api');

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasBtcBridgingYieldProviderUnstaked(allBridgings, near) {
  const batchName = `Batch UpdateAtlasBtcBridgingYieldProviderUnstaked`;

  // Check if a previous batch is still running
  if (flagsBatch.UpdateAtlasBtcBridgingYieldProviderUnstakedRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }
  else {  
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.UpdateAtlasBtcBridgingYieldProviderUnstakedRunning = true;
      const { BRIDGING_STATUS } = getConstants(); // Access constants dynamically
      
      // Filter bridgings that need to be processed
      const bridgings = allBridgings.filter(
        bridging => bridging.yield_provider_status === BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING
        && bridging.yield_provider_remarks === ""
      );

      console.log("bridgings", bridgings);
      bridgings.forEach(async (bridging) => {
        try {
          const get_summary = await near.bitHiveContract.get_summary();
          const unstakeTime = new Date(bridging.timestamp * 1000 + get_summary.withdrawal_waiting_time_ms + 60000); // give 1 minute buffer
          console.log("Unstake will be available at:", unstakeTime.toLocaleString());
          
          const now = new Date();
          if (unstakeTime <= now) {
            await near.updateBridgingFeesYieldProviderUnstaked(bridging.txn_hash);
          }

        } catch (error) {
          const remarks = `Error updating bridging yield provider unstaked: ${error} - ${error.reason}`;
          console.error(remarks);
          await near.updateBridgingFeesYieldProviderRemarks(bridging.txn_hash, remarks);
          return;
        }
      });

    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.UpdateAtlasBtcBridgingYieldProviderUnstakedRunning = false;
    }
  }
}

module.exports = { UpdateAtlasBtcBridgingYieldProviderUnstaked };
