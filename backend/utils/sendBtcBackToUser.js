const btc = require("bitcoinjs-lib");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");
const { runCoboIntegration } = require('./coboIntegration');

// TO FIND OUT AND DISCUSS FOR BATCH H (read redemption records from near smart contract and send BTC from atlas.btc_address to user's native btc address via chain signatures):
// 1. Do we want to check if BTC mempool already exists a record where OP_RETURN exists which tally with the BurnRedeem event before processing anything?
// Main function to process sending BTC back to users
async function SendBtcBackToUser(redemptions, near, bitcoin) {
  const batchName = `Batch H SendBtcBackToUser`;
  const { NETWORK_TYPE } = getConstants();

  // Check if a previous batch is still running
  if (flagsBatch.SendBtcBackToUserRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run...`);
    flagsBatch.SendBtcBackToUserRunning = true;

    // Filter eligible redemptions
    const txn_hash = await near.getFirstValidRedemption();

    
    if (txn_hash) {
      if (process.env.USE_COBO === 'true' ) {
          // If USE_COBO is true, run the Cobo integration logic
          await runCoboIntegration(txn_hash, near, bitcoin);
        } else {
          // Otherwise, run the original logic
          // To be implememted
        }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error in ${batchName}:`, error);
  } finally {
    flagsBatch.SendBtcBackToUserRunning = false;
  }
}


module.exports = { SendBtcBackToUser };
