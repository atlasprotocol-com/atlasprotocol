const { getConstants } = require("../constants");
const { updateOriginTxnHashMinted, isOriginTxnHashMinted, markEventProcessed } = require('../helpers/atbtcEventsHelper');

const { logErrorToFile } = require("./logger");

async function processEventsForChain(
  records,
  near,
  batchName,
) {
  
  const { BRIDGING_STATUS } = getConstants();
  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    console.log("record:: ", record);
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
      await logErrorToFile(record.txn_hash, "", error, 'ProcessEventsForChain');
    }
  }
}

async function processMintDepositEvent(event, near, chainId) {
  try {
    const btcTxnHash = event.returnValues.btcTxnHash;
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
        await updateOriginTxnHashMinted(btcTxnHash, transactionHash);
        await markEventProcessed(chainId, transactionHash);
        console.log(
          `Updated deposit for btc_txn_hash: ${btcTxnHash} with transactionHash: ${transactionHash}`,
        );
      } catch (error) {
        await logErrorToFile(btcTxnHash, transactionHash, error, 'UpdateDepositMintedTxnHash');
      }
    }
    else if (depositRecord && depositRecord.status === DEPOSIT_STATUS.BTC_MINTED_INTO_ABTC && depositRecord.minted_txn_hash !== "" && depositRecord.remarks === "") {
      console.log(`${btcTxnHash} already processed`);
      await markEventProcessed(chainId, transactionHash);
    }
  } catch (error) {
    const btcTxnHash = event.returnValues ? event.returnValues.btcTxnHash : event.btcTxnHash;
    const { transactionHash } = event;
    await logErrorToFile(btcTxnHash, transactionHash, error, 'ProcessMintDepositEvent');
  }
}

async function processBurnRedeemEvent(
  event,
  near,
  chainId,
  timestamp,
) {
  const { transactionHash } = event;
  const { DELIMITER } = getConstants();
  const redemptionTxnHash = `${chainId}${DELIMITER.COMMA}${transactionHash}`;
  const { wallet, btcAddress, amount } = event.returnValues;

  try {
    console.log("BurnRedeem event details:");
    console.log("- Wallet:", wallet);
    console.log("- BTC Address:", btcAddress);
    console.log("- Amount:", Number(amount));
    console.log("- Transaction Hash:", transactionHash);

    const redemptionRecord = await near.getRedemptionByTxnHash(redemptionTxnHash);

    if (!redemptionRecord) {
      try {
        await near.insertRedemptionAbtc(
          redemptionTxnHash,
          wallet,
          chainId,
          btcAddress,
          Number(amount),
          timestamp,
          timestamp,
        );
        await markEventProcessed(chainId, transactionHash);
        console.log(
          `Processed redemption: INSERT with txn hash ${redemptionTxnHash}`,
        );
      } catch (error) {
        await logErrorToFile("", redemptionTxnHash, error, 'InsertRedemptionAbtc');
        throw error;
      }
    }
  } catch (error) {
    await logErrorToFile("", redemptionTxnHash, error, 'ProcessBurnRedeemEvent');
    throw error;
  }
}

async function processBurnBridgeEvent(
  event,
  near,
  chainId,
  timestamp,
) {
  const { DELIMITER, BRIDGING_STATUS } = getConstants();

  try {

    const {
      wallet,
      destChainId,
      destChainAddress,
      amount,
      mintingFeeSat,
      bridgingFeeSat,
    } = event.returnValues;
    const { transactionHash } = event;
   
      
    console.log("BurnBridge event details:");
    console.log("- Address:", wallet);
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
      timestamp: Number(timestamp),
      status: BRIDGING_STATUS.ABTC_BURNT,
      remarks: "",
      date_created: Number(timestamp),
      verified_count: 0,
      minting_fee_sat: Number(mintingFeeSat),
      bridging_gas_fee_sat: Number(bridgingFeeSat),
    };

    await processEventsForChain([record], near, BRIDGING_STATUS);
    await markEventProcessed(chainId, transactionHash);

  } catch (error) {
    const { transactionHash } = event;
    const bridgingTxnHash = `${chainId}${DELIMITER.COMMA}${transactionHash}`;
    await logErrorToFile(bridgingTxnHash, "", error, 'ProcessBurnBridgeEvent');
    throw error;
  }
}

async function processMintBridgeEvent(event, near, chainId, timestamp) {
  try {
    const { BRIDGING_STATUS } = getConstants();
    const originTxnHash = event.returnValues.originTxnHash;
    const transactionHash = event.transactionHash;

    console.log("MintBridge event details:");
    console.log("- Origin Transaction Hash:", originTxnHash);
    console.log("- Transaction Hash:", transactionHash);

    if (await isOriginTxnHashMinted(originTxnHash)) {
      console.log(`${originTxnHash} already minted`);
      console.log(`${chainId} ${transactionHash} already processed`);
      await markEventProcessed(chainId, transactionHash);
      return;
    }

    const bridgingRecord = await near.getBridgingByTxnHash(originTxnHash);

    if (bridgingRecord.dest_txn_hash !== "") {
      console.log(`${originTxnHash} already bridged`);
      await updateOriginTxnHashMinted(bridgingRecord.txn_hash, transactionHash);
      await markEventProcessed(chainId, transactionHash);
      return;
    }

    if (
      bridgingRecord &&
      bridgingRecord.status === BRIDGING_STATUS.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST &&
      bridgingRecord.dest_txn_hash === "" &&
      bridgingRecord.remarks === ""
    ) {
      try {
        await near.updateBridgingMintedTxnHash(originTxnHash, transactionHash, timestamp);
        await updateOriginTxnHashMinted(originTxnHash, transactionHash);
        await markEventProcessed(chainId, transactionHash);
        console.log(
          `Updated bridging for txn_hash: ${originTxnHash} with transactionHash: ${transactionHash}`,
        );
      } catch (error) {
        console.log("error: ", error);
        await logErrorToFile(originTxnHash, transactionHash, error, 'UpdateBridgingMintedTxnHash');
        throw error;
      }
    }
  } catch (error) {
    const { originTxnHash } = event.returnValues;
    const { transactionHash } = event;
    await logErrorToFile(originTxnHash, transactionHash, error, 'ProcessMintBridgeEvent');
    throw error;
  }
}

module.exports = {
  processEventsForChain,
  processMintDepositEvent,
  processBurnRedeemEvent,
  processBurnBridgeEvent,
  processMintBridgeEvent,
};
