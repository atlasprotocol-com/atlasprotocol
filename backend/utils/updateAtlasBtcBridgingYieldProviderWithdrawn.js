const { createRelayerClient } = require("@bithive/relayer-api");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasBtcBridgingYieldProviderWithdrawn(
  allBridgings,
  near,
  bitcoinInstance,
) {
  const batchName = `Batch J UpdateAtlasBtcBridgingYieldProviderWithdrawn`;

  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  const { BRIDGING_STATUS, BITHIVE_STATUS } = getConstants(); // Access constants dynamically

  // Skip if the batch is already running
  if (flagsBatch.UpdateAtlasBtcBridgingYieldProviderWithdrawnRunning) return;

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcBridgingYieldProviderWithdrawnRunning = true;

    // Filter redemptions where status = BTC_YIELD_PROVIDER_WITHDRAWING
    const filteredTxns = allBridgings.filter(
      (bridging) =>
        bridging.origin_chain_id !== "" &&
        bridging.origin_chain_address !== "" &&
        bridging.dest_chain_id !== "" &&
        bridging.dest_chain_address !== "" &&
        bridging.yield_provider_status === BRIDGING_STATUS.ABTC_YIELD_PROVIDER_WITHDRAWING &&
        bridging.yield_provider_remarks === "" &&
        bridging.yield_provider_txn_hash !== "" &&
        bridging.yield_provider_gas_fee !== 0
    );
  
    const { publicKey } = await bitcoinInstance.deriveBTCAddress(near);
    const publicKeyString = publicKey.toString("hex");
    let i = 0;

    filteredTxns.forEach(async (txn) => {
      try {
        i++;
        console.log(`\nProcessing ${i} of ${filteredTxns.length} txns...`);
        
        const { deposit } = await relayer.user.getDeposit({
          publicKey: publicKeyString,
          txHash: txn.yield_provider_txn_hash,
        });

        if (
          [
            BITHIVE_STATUS.WITHDRAW_CONFIRMED,
            BITHIVE_STATUS.DEPOSIT_CONFIRMED,
            BITHIVE_STATUS.DEPOSIT_CONFIRMED_INVALID
          ].includes(
            deposit.status,
          )
        ) {
          await near.updateBridgingFeesYieldProviderWithdrawn(
            txn.txn_hash,
          );
          console.log(
            `Processed record ${i}: Updated Bridging yield provider withdrawn for txn hash ${txn.txn_hash}`
          );
        }
      }  catch (error) {
        
        const errorMessage = error.body && error.body.error_message 
            ? error.body.error_message 
            : error.toString();

        console.error(
          `Error processing record ${i} for txn hash ${txn.txn_hash}: `,
          errorMessage,
        );
        await near.updateBridgingFeesYieldProviderRemarks(
          txn.txn_hash,
          `Error processing txn: ${errorMessage}`,
        );

        // Skip to the next iteration if an error occurs
        return;
      }
    });

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasBtcBridgingYieldProviderWithdrawnRunning = false;
  }
}

module.exports = { UpdateAtlasBtcBridgingYieldProviderWithdrawn };
