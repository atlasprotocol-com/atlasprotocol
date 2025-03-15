const { getConstants } = require("../constants");

const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasBtcDeposited(
  depositRecords,
  near,
  bitcoinInstance,
) {
  const batchName = `Batch B UpdateAtlasBtcDeposited`;
  console.log(batchName);

  if (flagsBatch.UpdateAtlasBtcDepositedRunning) {
    return;
  }

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcDepositedRunning = true;

    const { DEPOSIT_STATUS } = getConstants();
    const currentBlockHeight = await bitcoinInstance.getCurrentBlockHeight();
    console.log("Current block height:", currentBlockHeight);

    
    const filteredRecords = depositRecords.filter(record => 
      record.status === DEPOSIT_STATUS.BTC_PENDING_DEPOSIT_MEMPOOL && 
      !record.remarks
    );

    //console.log("filteredRecords:", filteredRecords);

    for (const record of filteredRecords) {
      const btcTxnHash = record.btc_txn_hash;
      let timestamp = 0;

      try {
        // Get transaction details from mempool
        const txn = await bitcoinInstance.fetchRawTransaction(btcTxnHash);
       
        if(txn && txn.status.block_height && txn.status.confirmed){
          // console.log("txn_hash:", txn.txid, " confirmations:", currentBlockHeight - txn.status.block_height + 1);
          
          if (txn && txn.status.confirmed && (currentBlockHeight - txn.status.block_height + 1) >= process.env.BTC_MIN_CONFIRMATIONS) {
            console.log("btcTxnHash confirmed:", btcTxnHash);
            timestamp = txn.status.block_time;

            // Update existing record
            await near.updateDepositBtcDeposited(btcTxnHash, timestamp);
            
            console.log(`Updated Deposit with BTC txn hash ${btcTxnHash}`);
          }
        }
      } catch (error) {
        console.log("error.response.data:", error.response.data);

        await near.updateDepositRemarks(btcTxnHash, error.response.data);
        continue;
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasBtcDepositedRunning = false;
  }
}

module.exports = { UpdateAtlasBtcDeposited }; 