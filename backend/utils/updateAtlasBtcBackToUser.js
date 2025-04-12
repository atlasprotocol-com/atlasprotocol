const { getConstants } = require("../constants");

const { getChainConfig } = require("./network.chain.config");
const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasBtcBackToUser(allRedemptions, near, bitcoinInstance) {
  const batchName = `Batch J UpdateAtlasBtcBackToUser`;

  const { REDEMPTION_STATUS } = getConstants(); // Access constants dynamically

  const BTC_MIN_CONFIRMATIONS = Number(process.env.BTC_MIN_CONFIRMATIONS || 12);

  // Skip if the batch is already running
  if (flagsBatch.UpdateAtlasBtcBackToUserRunning) return;

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcBackToUserRunning = true;

    // Filter redemptions where status = BTC_PENDING_MEMPOOL_CONFIRMATION or BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER
    const filteredTxns = allRedemptions.filter((redemption) => {
      try {
        const chainConfig = getChainConfig(redemption.abtc_redemption_chain_id);
  
        return redemption.abtc_redemption_address !== "" &&
          redemption.abtc_redemption_chain_id !== "" &&
          redemption.btc_receiving_address !== "" &&
          redemption.status === REDEMPTION_STATUS.BTC_PENDING_MEMPOOL_CONFIRMATION &&
          redemption.remarks === "" &&
          redemption.yield_provider_txn_hash !== "" &&
          redemption.yield_provider_gas_fee !== 0 &&
          redemption.btc_txn_hash_verified_count >= chainConfig.validators_threshold;
      } catch (error) {
        const remarks = `Chain config not found for chain ID: ${redemption.abtc_redemption_chain_id}`;
        near.updateRedemptionRemarks(redemption.txn_hash, remarks);
        return false;
      }
    });

    for (const txn of filteredTxns) {
      try {
        const btcTxn = await bitcoinInstance.fetchTxnByTxnID(
          txn.btc_txn_hash,
        );
        
        const confirmations = await bitcoinInstance.getConfirmations(btcTxn.status.block_height);
        
        const ok = confirmations > BTC_MIN_CONFIRMATIONS;

        if (ok) {
            await near.updateRedemptionRedeemed(txn.txn_hash);
            console.log(
              `Processed record: Updated Redemption for txn hash ${txn.txn_hash} and BTC txn hash ${txn.btc_txn_hash}`,
            );
        }
      } catch (error) {
        const errorMessage =
          error.body && error.body.error_message
            ? error.body.error_message
            : error.toString();

        console.error(
          `Error processing record for txn hash ${txn.txn_hash}: `,
          errorMessage,
        );
        await near.updateRedemptionRemarks(
          txn.txn_hash,
          `Error processing txn: ${errorMessage}`,
        );

        // Skip to the next iteration if an error occurs
        continue;
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasBtcBackToUserRunning = false;
  }
}

module.exports = { UpdateAtlasBtcBackToUser };
