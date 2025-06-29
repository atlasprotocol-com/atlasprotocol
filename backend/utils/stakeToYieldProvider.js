const { createRelayerClient } = require("@bithive/relayer-api");

const { getConstants } = require("../constants");
const {
  updateOffchainDepositStatus,
  updateOffchainDepositRemarks,
  updateOffchainYieldProviderTxnHash,
  getDepositsToBeStaked,
} = require("../helpers/depositsHelper");

const { getChainConfig } = require("./network.chain.config");
const { flagsBatch } = require("./batchFlags");

async function StakeToYieldProvider(allDeposits, near, bitcoinInstance) {
  const batchName = `Batch C StakeToYieldProvider`;

  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.stakeToYieldProviderRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.stakeToYieldProviderRunning = true;

      const { DEPOSIT_STATUS } = getConstants(); // Access constants dynamically

      const { address, publicKey } =
        await bitcoinInstance.deriveBTCAddress(near);

      const filteredDeposits = await getDepositsToBeStaked(allDeposits);
      console.log(
        "filteredDeposits in stakeToYieldProvider: ",
        filteredDeposits.length,
      );

      let allUTXOs;

      if (filteredDeposits.length > 0) {
        allUTXOs = await bitcoinInstance.fetchUTXOs(address);
      }

      for (let i = 0; i < filteredDeposits.length; i++) {
        const depositRecord = filteredDeposits[i];
        console.log("stakeToYieldProvider loop: ", i);
        console.log("Processing deposit:", depositRecord);
        const btcTxnHash = depositRecord.btc_txn_hash;
        const yieldProviderGasFee = depositRecord.yield_provider_gas_fee;

        try {
          // Convert publicKey to a string
          const publicKeyString = publicKey.toString("hex");

          const utxos = allUTXOs
            .filter((utxo) => utxo.txid === btcTxnHash)
            .map((utxo) => ({
              txHash: utxo.txid,
              vout: utxo.vout,
            }));

          // 1. Build the PSBT that is ready for signing
          const { psbt: unsignedPsbtHex } =
            await relayer.deposit.buildUnsignedPsbt({
              utxos,
              publicKey: publicKeyString,
              address,
              btcTxnHash,
              fee: Number(yieldProviderGasFee),
            });

          // 2. Sign the PSBT via chain signature
          const signedPsbt = await bitcoinInstance.mpcSignPsbt(
            near,
            unsignedPsbtHex,
          );

          signedPsbt.finalizeAllInputs();
          const signedPsbtHex = signedPsbt.toHex();

          // 3. Submit the finalized PSBT for broadcasting and relaying
          const { txHash } = await relayer.deposit.submitFinalizedPsbt({
            psbt: signedPsbtHex,
            publicKey: publicKeyString,
          });

          console.log("txHash:", txHash);
          console.log("Updating Yield provider txn hash");

          await near.updateYieldProviderTxnHash(btcTxnHash, txHash);
          await updateOffchainYieldProviderTxnHash(
            allDeposits,
            btcTxnHash,
            DEPOSIT_STATUS.BTC_PENDING_YIELD_PROVIDER_DEPOSIT,
            txHash,
          );

          console.log("Yield provider txn hash updated");

          console.log(`${batchName} completed successfully.`);
        } catch (error) {
          let remarks = "";
          console.log("error: ", error);

          // Log the error data if available
          if (error.response && error.response.data.error.message) {
            console.log("error.response.data", error.response.data);
            remarks = `Error staking to yield provider: ${JSON.stringify(error.response.data.error.message)}`;
          } else {
            remarks = `Error staking to yield provider: ${error} - ${error.reason}`;
          }
          console.error(remarks);
          if (error.message.includes("Empty UTXOs")) {
            console.log("Empty UTXOs error");
            const spendingTxs = await bitcoinInstance.findSpendingTransaction(
              btcTxnHash,
              address,
            );
            console.log("spendingTxs: ", spendingTxs);
            if (spendingTxs) {
              await near.updateYieldProviderTxnHash(btcTxnHash, spendingTxs);
              await updateOffchainYieldProviderTxnHash(
                allDeposits,
                btcTxnHash,
                DEPOSIT_STATUS.BTC_PENDING_YIELD_PROVIDER_DEPOSIT,
                spendingTxs,
              );
            } else {
              await near.updateDepositRemarks(btcTxnHash, remarks);
              await updateOffchainDepositRemarks(
                allDeposits,
                btcTxnHash,
                remarks,
              );
            }
          } else {
            await near.updateDepositRemarks(btcTxnHash, remarks);
            await updateOffchainDepositRemarks(
              allDeposits,
              btcTxnHash,
              remarks,
            );
          }
        }
      }
    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.stakeToYieldProviderRunning = false;
    }
  }
}

async function getBithiveDeposits(publicKeyHex, totalDeposits) {
  if (totalDeposits <= 0) {
    return [];
  }

  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });
  let deposits = [];
  const limit = 1000;
  let currentOffset = 0;

  try {
    // Fetch batches sequentially
    while (true) {
      console.log(
        "[getBithiveDeposits] Fetching batch with offset:",
        currentOffset,
      );

      const { deposits: batchDeposits } = await relayer.user.getDeposits({
        publicKey: publicKeyHex,
        offset: currentOffset,
        limit,
      });

      if (batchDeposits.length === 0) {
        break; // No more deposits to fetch
      }

      deposits = deposits.concat(batchDeposits);
      console.log(
        `[getBithiveDeposits] Fetched ${deposits.length} bithive deposits in batch ${totalDeposits}`,
      );

      currentOffset = currentOffset + limit;

      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    console.log(
      "[getBithiveDeposits] New bithive deposits fetched:",
      deposits.length,
    );
    return deposits;
  } catch (error) {
    console.error("Failed to fetch Bithive deposits:", error);
    throw error;
  }
}

module.exports = { StakeToYieldProvider, getBithiveDeposits };
