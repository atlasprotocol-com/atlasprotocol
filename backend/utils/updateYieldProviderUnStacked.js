const { createRelayerClient } = require('@bithive/relayer-api');

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");



async function UpdateYieldProviderUnStacked(allRedemptions, near, bitcoinInstance) {
  const batchName = `Batch H UpdateYieldProviderUnStacked`;
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.UpdateYieldProviderUnStackedRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }
  else {  
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.UpdateYieldProviderUnStackedRunning = true;
      const { REDEMPTION_STATUS } = getConstants(); // Access constants dynamically
      const { address, publicKey } = await bitcoinInstance.deriveBTCAddress(near);

      const publicKeyString = publicKey.toString("hex");
      
      // Filter deposits that need to be processed
      const filteredTxns = allRedemptions.filter(
        (redemption) =>
          redemption.status === REDEMPTION_STATUS.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING &&
          redemption.remarks === "",
      );

      filteredTxns.forEach(async (txn) => {
        
        try {
          const get_summary = await near.bitHiveContract.get_summary();
          const unstakeTime = new Date(txn.timestamp * 1000 + get_summary.withdrawal_waiting_time_ms);
          console.log("Unstake will be available at:", unstakeTime.toLocaleString());
          
          const now = new Date();
          if (unstakeTime <= now) {
            await near.updateRedemptionYieldProviderUnstaked(txn.txn_hash);
          }

        } catch (error) {
          const remarks = `Error updating yield provider unstacked: ${error} - ${error.reason}`;
          console.error(remarks);
          //await near.updateRedemptionRemarks(txn.txn_hash, remarks);
          return;
        }
      });

    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.UpdateYieldProviderUnStackedRunning = false;
    }
  }
}

module.exports = { UpdateYieldProviderUnStacked };
