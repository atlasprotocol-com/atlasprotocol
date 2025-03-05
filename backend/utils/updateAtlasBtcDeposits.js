const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");
const {
  getLastProcessedConfirmedTime,
  setLastProcessedConfirmedTime,
} = require("./batchTime/btcLastProcessedConfirmedTime"); // Import helper functions

async function UpdateAtlasBtcDeposits(
  btcMempool,
  btcAtlasDepositAddress,
  treasuryAddress,
  depositFeePercentage,
  near,
  bitcoin,
) {
  const batchName = `Batch A UpdateAtlasBtcDeposits`;
  console.log(treasuryAddress);

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
        !txn.vin.some(
          (vin) => vin.prevout.scriptpubkey_address === btcAtlasDepositAddress
        ) &&
        (txn.status.block_time > lastProcessedConfirmedTime ||
          !txn.status.confirmed),
    );

    console.log(
      `${batchName} Btc Mempool number of Deposit records: total:${btcMempool.data.length} filtered:${filteredTxns.length}`,
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
          
          // Insert new deposit record

          const btcSenderAddress = await bitcoin.getBtcSenderAddress(txn);

          let {
            chain: receivingChainID,
            address: receivingAddress,
            yieldProviderGasFee,
            protocolFee,
            mintingFee,
            remarks,
          } = await bitcoin.getChainAndAddressFromTxnHash(txn);

          if (receivingChainID && receivingAddress) {
            console.log("New record found");
            console.log("receivingChainID:", receivingChainID);
            console.log("receivingAddress:", receivingAddress);
            console.log("btcTxnHash:", btcTxnHash);
            const { btcAmount, feeAmount } = await bitcoin.getBtcReceivingAmount(
              txn,
              btcAtlasDepositAddress,
              treasuryAddress
            );
            console.log("btcAmount:", btcAmount);
            console.log("feeAmount:", feeAmount);
            if (feeAmount < (protocolFee + mintingFee)) {
              remarks = `protocolFee + mintingFee doesn't match`;
            }
            
            // Use confirmed timestamp if available, otherwise fetch unconfirmed time
            timestamp = blnStatusConfirmed
              ? txn.status.block_time
              : await bitcoin.fetchUnconfirmedTransactionTime(txn);

            await near.insertDepositBtc(
              btcTxnHash,
              btcSenderAddress,
              receivingChainID,
              receivingAddress,
              btcAmount,
              protocolFee,
              "",
              mintingFee,
              timestamp,
              remarks,
              timestamp,
              yieldProviderGasFee,
              ""
            );

            console.log(`Inserted Deposit with BTC txn hash ${btcTxnHash}`);
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
