const btc = require("bitcoinjs-lib");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");
const { runCoboIntegration } = require("./coboIntegration");

// Main function to process sending BTC back to users
async function SendBtcBackToUser(redemptions, near) {
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
      if (process.env.USE_COBO === "true") {
        // If USE_COBO is true, run the Cobo integration logic
        await runCoboIntegration(txn_hash, near);
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
