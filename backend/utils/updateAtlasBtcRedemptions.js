const { Web3 } = require("web3");
const _ = require("lodash");

const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { getAllChainConfig } = require("./network.chain.config");
const { flagsBatch, blockRange } = require("./batchFlags");
const {
  setBlockCursor,
  getBlockCursor,
} = require("./batchTime/lastScannedBlockHelper");

const batchName = `Batch F UpdateAtlasBtcRedemptions`;

async function UpdateAtlasBtcRedemptions(near) {
  if (flagsBatch.UpdateAtlasBtcRedemptionsRunning) {
    console.log(`${batchName} Batch is not incomplete. Will skip this run.`);
    return;
  }

  try {
    console.log(`${batchName} Start run ...`);
    flagsBatch.UpdateAtlasBtcRedemptionsRunning = true;

    const { NETWORK_TYPE, DELIMITER } = getConstants();
    const chainConfig = getAllChainConfig();

    const evmChains = Object.values(chainConfig).filter(
      (chain) => chain.networkType === NETWORK_TYPE.EVM,
    );

    // Process each EVM chain in batches
    for (const chain of evmChains) {
      console.log(`${batchName} EVM: ${chain.chainID}`);

      const web3 = new Web3(chain.chainRpcUrl);
      const ethereum = new Ethereum(
        chain.chainID,
        chain.chainRpcUrl,
        chain.gasLimit,
        chain.aBTCAddress,
        chain.abiPath,
      );

      const endBlock = await ethereum.getCurrentBlockNumber();
      const startBlock = await getBlockCursor(
        "UpdateAtlasBtcRedemptions",
        chain.chainID,
        endBlock,
      );

      console.log(
        `${batchName} EVM: ${chain.chainID} startBlock: ${startBlock} endBlock: ${endBlock}`,
      );
      
      try {
        const events = await ethereum.getPastBurnEventsInBatches(
          startBlock - 100,
          endBlock,
          blockRange(Number(chainConfig.batchSize)),
        );

        console.log(
          `${batchName} ${chain.networkName}: Found ${events.length} Burn events`,
        );

        // Cache events and process redemptions
        const eventMap = new Map();
        for (const event of events) {
          const { returnValues, transactionHash, blockNumber } = event;
          const { wallet, btcAddress, amount } = returnValues;

          // Fetch the block by blockNumber to get the timestamp of the event
          const block = await web3.eth.getBlock(blockNumber);
          const timestamp = Number(block.timestamp);

          // Set the event details in the eventMap with the timestamp
          eventMap.set(transactionHash, {
            wallet,
            btcAddress,
            amount,
            timestamp,
          });
        }

        // Process the events and update last scanned block
        await processEventsForChain(eventMap, chain, near, DELIMITER);
        setBlockCursor("UpdateAtlasBtcRedemptions", chain.chainID, endBlock);
      } catch (error) {
        console.error(`${batchName} ${chain.chainID}: ${err.message}`);
      }
    }

    // Process NEAR chains similarly
    const nearChains = Object.values(chainConfig).filter(
      (chain) => chain.networkType === NETWORK_TYPE.NEAR,
    );
    console.log("1");
    for (const chain of nearChains) {
      const endBlock = await near.getCurrentBlockNumber();
      const startBlock = await getBlockCursor(
        "UpdateAtlasBtcRedemptions",
        chain.chainID,
        endBlock,
      );

      console.log(
        `${batchName} NEAR: ${chain.chainID} startBlock: ${startBlock} endBlock: ${endBlock}`,
      );

      try {
        const events = await near.getPastBurnRedemptionEventsInBatches(
          startBlock,
          endBlock,
          chain.aBTCAddress,
        );
        console.log("2");

        const eventMap = new Map();
        for (const event of events) {
          const {
            returnValues: { amount, wallet, btcAddress },
            transactionHash,
            timestamp,
          } = event;

          eventMap.set(transactionHash, {
            wallet,
            btcAddress,
            amount,
            timestamp,
          });
        }
        console.log("3");
        // Process the events and update last scanned block
        await processEventsForChain(eventMap, chain, near, DELIMITER);
        console.log("4");
        setBlockCursor("UpdateAtlasBtcRedemptions", chain.chainID, endBlock);
      } catch (err) {
        console.error(`${batchName} ${chain.chainID}: ${err.message}`);
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (err) {
    console.error(`${batchName}: ${err.message}`);
  } finally {
    flagsBatch.UpdateAtlasBtcRedemptionsRunning = false;
  }
}

async function processEventsForChain(eventMap, chain, near, DELIMITER) {
  let i = 0;
  for (const [
    transactionHash,
    { wallet, btcAddress, amount, timestamp },
  ] of eventMap.entries()) {
    i++;

    try {
      const redemptionTxnHash = `${chain.chainID}${DELIMITER.COMMA}${transactionHash}`;
      const recordExists = await near.getRedemptionByTxnHash(redemptionTxnHash);

      if (!recordExists) {
        await near.insertRedemptionAbtc(
          redemptionTxnHash,
          wallet,
          chain.chainID,
          btcAddress,
          Number(amount),
          timestamp,
          timestamp,
        );

        console.log(
          `Processed record ${i}: INSERT Redemption with txn hash ${redemptionTxnHash}`,
        );
      }
    } catch (error) {
      console.error(`Error processing record ${i}:`, error);
    }
  }
}

module.exports = { UpdateAtlasBtcRedemptions };
