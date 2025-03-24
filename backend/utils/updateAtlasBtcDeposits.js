const { flagsBatch } = require("./batchFlags");
const {
  getLastProcessedConfirmedTime,
  setLastProcessedConfirmedTime,
} = require("./batchTime/btcLastProcessedConfirmedTime"); // Import helper functions

async function UpdateAtlasBtcDeposits(
  btcMempool,
  btcAtlasDepositAddress,
  treasuryAddress,
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

    const lastProcessedConfirmedTime = getLastProcessedConfirmedTime(); // Get the last polled time

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

    for (const txn of filteredTxns) {
      const btcTxnHash = txn.txid;

      try {
        
        await processNewDeposit(txn, near, bitcoin, btcAtlasDepositAddress, treasuryAddress);
      } catch (error) {
        console.error(`Error processing BTC txn hash ${btcTxnHash}:`, error);
        continue; // Skip to the next transaction
      }
    }

    setLastProcessedConfirmedTime(Math.floor(Date.now() / 1000));
    
    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasBtcDepositsRunning = false;
  }
}

async function processNewDeposit(txn, near, bitcoin, btcAtlasDepositAddress, treasuryAddress) {
  const btcTxnHash = txn.txid;

  // Check if the deposit record exists in NEAR
  const recordExists = await near.getDepositByBtcTxnHash(btcTxnHash);
  
  if (!recordExists) {
    // Insert new deposit record
    console.log("Insert new deposit record");

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
      console.log("yieldProviderGasFee:", yieldProviderGasFee);
      console.log("protocolFee:", protocolFee);
      console.log("mintingFee:", mintingFee);
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
      
      timestamp = Math.floor(Date.now() / 1000);

      await near.insertDepositBtc(
        btcTxnHash,
        btcSenderAddress,
        receivingChainID,
        receivingAddress,
        btcAmount + feeAmount,
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
}



module.exports = { UpdateAtlasBtcDeposits, processNewDeposit };
