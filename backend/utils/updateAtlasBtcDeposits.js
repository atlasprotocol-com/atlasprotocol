const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");
const {
  getLastProcessedConfirmedTime,
  setLastProcessedConfirmedTime,
} = require("./batchTime/btcLastProcessedConfirmedTime"); // Import helper functions

async function UpdateAtlasBtcDeposits(
  btcMempool,
  btcAtlasDepositAddress,
  near,
  bitcoin,
) {
  const batchName = `Batch A UpdateAtlasBtcDeposits`;

  if (flagsBatch.UpdateAtlasBtcDepositsRunning) {
    return;
  }

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcDepositsRunning = true;

    const { DEPOSIT_STATUS } = getConstants();
    const lastProcessedConfirmedTime = getLastProcessedConfirmedTime(); // Get the last polled time
    let newLastProcessedConfirmedTime = 0;

    console.log(
      `${batchName} Latest Polled Time: ${lastProcessedConfirmedTime}`,
    );

    // Filter BTC mempool transactions based on address and block time
    const filteredTxns = btcMempool.data.filter(
      (txn) =>
        txn.vout.some(
          (vout) => vout.scriptpubkey_address === btcAtlasDepositAddress,
        ) &&
        (txn.status.block_time > lastProcessedConfirmedTime ||
          !txn.status.confirmed),
    );

    console.log(
      `Btc Mempool number of Deposit records: ${filteredTxns.length}`,
    );

    let i = 0;

    for (const txn of filteredTxns) {
      i++;
      const btcTxnHash = txn.txid;
      const blnStatusConfirmed = txn.status.confirmed;
      let timestamp = 0;

      try {
        // Check if the deposit record exists in NEAR
        const recordExists = await near.getDepositByBtcTxnHash(btcTxnHash);

        if (recordExists) {
          console.log("Record exist");
          if (txn.status.block_time > newLastProcessedConfirmedTime) {
            newLastProcessedConfirmedTime = txn.status.block_time;
          }
          if (
            recordExists.status ===
              DEPOSIT_STATUS.BTC_PENDING_DEPOSIT_MEMPOOL &&
            !recordExists.remarks &&
            blnStatusConfirmed
          ) {
            console.log("Status updated");
            timestamp = txn.status.block_time;

            // Update existing record
            await near.updateDepositBtcDeposited(btcTxnHash, timestamp);
            console.log(`Updated Deposit with BTC txn hash ${btcTxnHash}`);
          }
        } else {
          console.log("New record found");
          // Insert new deposit record

          const btcSenderAddress = await bitcoin.getBtcSenderAddress(txn);
          const {
            chain: receivingChainID,
            address: receivingAddress,
            remarks,
          } = await bitcoin.getChainAndAddressFromTxnHash(txn);

          if (receivingChainID && receivingAddress) {
            const btcAmount = await bitcoin.getBtcReceivingAmount(
              txn,
              btcAtlasDepositAddress,
            );

            // Use confirmed timestamp if available, otherwise fetch unconfirmed time
            timestamp = blnStatusConfirmed
              ? txn.status.block_time
              : await bitcoin.fetchUnconfirmedTransactionTime(txn);

            const mintedTxnHash = "";

            await near.insertDepositBtc(
              btcTxnHash,
              btcSenderAddress,
              receivingChainID,
              receivingAddress,
              btcAmount,
              mintedTxnHash,
              timestamp,
              remarks,
              timestamp,
            );

            console.log(`Inserted Deposit with BTC txn hash ${btcTxnHash}`);
          } else {
            console.log(
              `Skipping deposit record for BTC txn hash ${btcTxnHash}: missing receiving chain/address`,
            );
          }
        }
      } catch (error) {
        console.error(`Error processing BTC txn hash ${btcTxnHash}:`, error);
        continue; // Skip to the next transaction
      }
    }

    if (newLastProcessedConfirmedTime > 0) {
      setLastProcessedConfirmedTime(newLastProcessedConfirmedTime);
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasBtcDepositsRunning = false;
  }
}

module.exports = { UpdateAtlasBtcDeposits };
