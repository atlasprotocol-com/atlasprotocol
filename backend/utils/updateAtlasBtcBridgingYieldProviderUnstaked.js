const { createRelayerClient } = require('@bithive/relayer-api');

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasBtcBridgingYieldProviderUnstaked(allBridgings, near, bitcoinInstance) {
  const batchName = `Batch UpdateAtlasBtcBridgingYieldProviderUnstaked`;
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

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
      
      const { address, publicKey } = await bitcoinInstance.deriveBTCAddress(near);

      const publicKeyString = publicKey.toString("hex");

      // Filter bridgings that need to be processed
      const bridgings = allBridgings.filter(
        bridging => bridging.yield_provider_status === BRIDGING_STATUS.ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING
        && bridging.yield_provider_remarks === ""
      );

      console.log("bridgings", bridgings);
      bridgings.forEach(async (bridging) => {
        try {
          await relayer.unstake.waitUntilConfirmed({ amount: Number(bridging.minting_fee_sat + bridging.yield_provider_gas_fee + bridging.protocol_fee), publicKey: publicKeyString }, { timeout: 3000 }); 
          await near.updateBridgingFeesYieldProviderUnstaked(bridging.txn_hash);

        } catch (error) {
          const remarks = `Error updating bridging yield provider unstaked: ${error} - ${error.reason}`;
          console.error(remarks);
          // if (!error.toString().includes("Waiting for Unstake action timeout")) {
          //   await near.updateBridgingFeesYieldProviderRemarks(bridging.txn_hash, remarks);
          // }
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
