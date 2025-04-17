const fs = require('fs');
const path = require('path');

const { getConstants } = require("../constants");

const { logErrorToFile } = require("./logger");

async function processEventsForChain(
  records,
  near,
  batchName,
) {
  const { BRIDGING_STATUS } = getConstants();
  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    try {
      const exist = await near.getBridgingByTxnHash(record.txn_hash);
      if (exist) {
        console.log(
          `[${record.txn_hash}]: EXIST ${record.origin_chain_id} -> ${record.dest_chain_id} | status:${exist.status}`,
        );
        if (
          exist.status === BRIDGING_STATUS.ABTC_PENDING_BURNT &&
          record.status === BRIDGING_STATUS.ABTC_BURNT
        ) {
          console.log(
            `${batchName} [${record.txn_hash}]: UPDATE Bridging record ${i}`,
          );
          await near.updateBridgingBtcBridged(record);
        }

        continue;
      }

      await near.insertBridgingAbtc(record);
      console.log(
        `${batchName} [${record.txn_hash}]: INSERT Bridging record ${i}`,
      );
    } catch (error) {
      console.error(
        `${batchName} [${record.txn_hash}]: Error processing record ${i}:`,
        error,
      );
    }
  }
}

async function processMintDepositEvent(event, near) {
  
  const btcTxnHash = event.returnValues ? event.returnValues.btcTxnHash : event.btcTxnHash;
  const { transactionHash } = event;
  const { DEPOSIT_STATUS } = getConstants();
  console.log("MintDeposit event details:");
  console.log("- BTC Transaction Hash:", btcTxnHash);
  console.log("- Transaction Hash:", transactionHash);

  const depositRecord = await near.getDepositByBtcTxnHash(btcTxnHash);

  if (
    depositRecord &&
    depositRecord.status === DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC &&
    depositRecord.minted_txn_hash === "" &&
    depositRecord.remarks === ""
  ) {
    try {
      
      await near.updateDepositMintedTxnHash(btcTxnHash, transactionHash);
      console.log(
        `Updated deposit for btc_txn_hash: ${btcTxnHash} with transactionHash: ${transactionHash}`,
      );
      
    } catch (error) {
      // Log error to daily file with batch name
      await logErrorToFile(btcTxnHash, transactionHash, error, 'UpdateDepositMintedTxnHash');
    }
  }
}

async function processBurnRedeemEvent(
  event,
  near,
  chainId,
  DELIMITER,
  timestamp,
) {
  
  const { wallet, btcAddress, amount } = event.returnValues;
  const { transactionHash } = event;

  console.log("BurnRedeem event details:");
  console.log("- Wallet:", wallet);
  console.log("- BTC Address:", btcAddress);
  console.log("- Amount:", Number(amount));
  console.log("- Transaction Hash:", transactionHash);

  const redemptionTxnHash = `${chainId}${DELIMITER.COMMA}${transactionHash}`;
  const redemptionRecord = await near.getRedemptionByTxnHash(redemptionTxnHash);

  if (!redemptionRecord) {
    try {
      //throw new Error("Test error");
      await near.insertRedemptionAbtc(
        redemptionTxnHash,
        wallet,
        chainId,
        btcAddress,
        Number(amount),
        timestamp,
        timestamp,
      );

      console.log(
        `Processed redemption: INSERT with txn hash ${redemptionTxnHash}`,
      );
    } catch (error) {
      // Log error to daily file with batch name
      await logErrorToFile("", redemptionTxnHash, error, 'InsertRedemptionAbtc');
    }
  }
}

async function processBurnBridgeEvent(
  event,
  near,
  chainId,
  timestamp,
) {
  
  const {
    wallet,
    destChainId,
    destChainAddress,
    amount,
    mintingFeeSat,
    bridgingFeeSat,
  } = event.returnValues;
  const { transactionHash } = event;
  const { DELIMITER, BRIDGING_STATUS } = getConstants();
    
  console.log("BurnBridge event details:");
  console.log("- Wallet:", wallet);
  console.log("- Destination Chain ID:", destChainId);
  console.log("- Destination Chain Address:", destChainAddress);
  console.log("- Amount:", amount);
  console.log("- Minting Fee:", mintingFeeSat);
  console.log("- Bridging Fee:", bridgingFeeSat);
  console.log("- Transaction Hash:", transactionHash);

  const bridgingTxnHash = `${chainId}${DELIMITER.COMMA}${transactionHash}`;
  const record = {
    txn_hash: bridgingTxnHash,
    origin_chain_id: chainId,
    origin_chain_address: wallet,
    dest_chain_id: destChainId,
    dest_chain_address: destChainAddress,
    dest_txn_hash: "",
    abtc_amount: Number(amount),
    timestamp,
    status: BRIDGING_STATUS.ABTC_BURNT,
    remarks: "",
    date_created: timestamp,
    verified_count: 0,
    minting_fee_sat: Number(mintingFeeSat),
    bridging_gas_fee_sat: Number(bridgingFeeSat),
  };

  await processEventsForChain([record], near, BRIDGING_STATUS);
}

async function processMintBridgeEvent(event, near, timestamp) {
  const { BRIDGING_STATUS } = getConstants();
  const { originTxnHash } = event.returnValues;
  const { transactionHash } = event;

  console.log("MintBridge event details:");
  console.log("- Origin Transaction Hash:", originTxnHash);
  console.log("- Transaction Hash:", transactionHash);

  const bridgingRecord = await near.getBridgingByTxnHash(originTxnHash);
  if (
    bridgingRecord &&
    bridgingRecord.status === BRIDGING_STATUS.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST &&
    bridgingRecord.dest_txn_hash === "" &&
    bridgingRecord.remarks === ""
  ) {
    await near.updateBridgingMinted(originTxnHash, transactionHash, timestamp);
    console.log(
      `Updated bridging for txn_hash: ${originTxnHash} with transactionHash: ${transactionHash}`,
    );
  }
}

module.exports = {
  processEventsForChain,
  processMintDepositEvent,
  processBurnRedeemEvent,
  processBurnBridgeEvent,
  processMintBridgeEvent,
};
