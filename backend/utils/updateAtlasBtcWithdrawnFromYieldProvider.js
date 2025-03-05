// Import required dependencies
const { createRelayerClient } = require("@bithive/relayer-api");

const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

/**
 * Updates the status of BTC redemptions that have been withdrawn from yield provider
 * @param {Array} allRedemptions - Array of all redemption records
 * @param {Object} near - Near protocol instance for making contract calls
 * @param {Object} bitcoinInstance - Bitcoin instance for deriving addresses
 */
async function UpdateAtlasBtcWithdrawnFromYieldProvider(
  allRedemptions,
  near,
  bitcoinInstance,
) {
  const batchName = `Batch J UpdateAtlasBtcWithdrawnFromYieldProvider`;

  // Initialize relayer client for communicating with BitHive
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Get status constants
  const { REDEMPTION_STATUS, BITHIVE_STATUS } = getConstants();

  // Prevent concurrent batch runs
  if (flagsBatch.UpdateAtlasBtcWithdrawnFromYieldProviderRunning) return;

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcWithdrawnFromYieldProviderRunning = true;

    // Filter valid redemptions that are in withdrawing state
    // Must have valid addresses, non-empty yield provider txn hash, and gas fee
    const filteredTxns = allRedemptions.filter(
      (redemption) =>
        redemption.abtc_redemption_address !== "" &&
        redemption.abtc_redemption_chain_id !== "" &&
        redemption.btc_receiving_address !== "" &&
        redemption.status ===
          REDEMPTION_STATUS.BTC_YIELD_PROVIDER_WITHDRAWING &&
        redemption.remarks === "" &&
        redemption.yield_provider_txn_hash !== "" &&
        redemption.yield_provider_gas_fee !== 0,
    );

    // Get unique yield provider transaction hashes to process
    const distinctYieldProviderTxns = [
      ...new Set(filteredTxns.map((txn) => txn.yield_provider_txn_hash)),
    ];

    console.log(
      `Found ${distinctYieldProviderTxns.length} distinct yield provider transactions`,
    );
    if (distinctYieldProviderTxns.length === 0) {
      console.log("No yield provider transactions to process");
      return;
    }

    // Get BTC public key for querying deposits
    const { publicKey } = await bitcoinInstance.deriveBTCAddress(near);
    const publicKeyString = publicKey.toString("hex");
    let i = 0;

    // Process each yield provider transaction
    for (let i = 0; i < distinctYieldProviderTxns.length; i++) {
      const yieldProviderTxnHash = distinctYieldProviderTxns[i];
      console.log(
        `\nProcessing ${i + 1} of ${distinctYieldProviderTxns.length} yield provider transactions...`,
      );

      try {
        // Query deposit status from BitHive relayer
        const { deposit } = await relayer.user.getDeposit({
          publicKey: publicKeyString,
          txHash: yieldProviderTxnHash,
        });
        console.log("deposit", deposit);
        // If withdrawal is confirmed, update redemption statuses
        if ([
          BITHIVE_STATUS.WITHDRAW_CONFIRMED,
          BITHIVE_STATUS.DEPOSIT_CONFIRMED,
          BITHIVE_STATUS.DEPOSIT_CONFIRMED_INVALID
        ].includes(deposit.status)) {
          // Get all redemptions associated with this yield provider txn
          const redemptionsToUpdate = filteredTxns.filter(
            (txn) => txn.yield_provider_txn_hash === yieldProviderTxnHash,
          );

          // Update each redemption's status to withdrawn
          for (const redemption of redemptionsToUpdate) {
            await near.updateRedemptionWithdrawnFromYieldProvider(
              redemption.txn_hash,
            );
            console.log(
              `Updated Redemption for txn hash ${redemption.txn_hash} and BTC txn hash ${redemption.btc_txn_hash}`,
            );
          }
        }
      } catch (error) {
        // Extract error message from response or convert error to string
        const errorMessage =
          error.body && error.body.error_message
            ? error.body.error_message
            : error.toString();

        console.error(
          `Error processing yield provider txn hash ${yieldProviderTxnHash}: `,
          errorMessage,
        );

        // Update remarks for all redemptions affected by the error
        const redemptionsToUpdate = filteredTxns.filter(
          (txn) => txn.yield_provider_txn_hash === yieldProviderTxnHash,
        );

        for (const redemption of redemptionsToUpdate) {
          await near.updateRedemptionRemarks(
            redemption.txn_hash,
            `Error processing txn: ${errorMessage}`,
          );
        }
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    // Reset running flag regardless of success/failure
    flagsBatch.UpdateAtlasBtcWithdrawnFromYieldProviderRunning = false;
  }
}

module.exports = { UpdateAtlasBtcWithdrawnFromYieldProvider };
