const { Web3 } = require("web3");

const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { getAllChainConfig } = require("./network.chain.config");
const { flagsBatch } = require("./batchFlags");
const { loadLastScannedBlocks, saveLastScannedBlocks } = require("./batchTime/lastScannedBlockHelper");

async function UpdateAtlasBtcRedemptions(near) {
  const batchName = `Batch E UpdateAtlasBtcRedemptions`;

  if (flagsBatch.UpdateAtlasBtcRedemptionsRunning) {
    console.log(`Previous ${batchName} incomplete. Will skip this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasBtcRedemptionsRunning = true;

    const { NETWORK_TYPE, DELIMITER } = getConstants();
    const chainConfig = getAllChainConfig();

    // Load the last scanned blocks data
    const lastScannedBlocks = await loadLastScannedBlocks();

    const evmChains = Object.values(chainConfig).filter(
      (chain) => chain.networkType === NETWORK_TYPE.EVM,
    );

    // Process each EVM chain in batches
    for (const chain of evmChains) {
      console.log(`Processing EVM Chain ID: ${chain.chainID}`);

      const web3 = new Web3(chain.chainRpcUrl);
      const ethereum = new Ethereum(
        chain.chainID,
        chain.chainRpcUrl,
        chain.gasLimit,
        chain.aBTCAddress,
        chain.abiPath,
      );

      // Get the last scanned block or default to a reasonable starting block
      const startBlock = lastScannedBlocks[chain.chainID] || (await ethereum.getCurrentBlockNumber()) - 1000n;
      const endBlock = await ethereum.getCurrentBlockNumber();

      try {
        const events = await ethereum.getPastBurnEventsInBatches(
          startBlock,
          endBlock,
          chain.batchSize,
        );

        console.log(`${chain.networkName}: Found ${events.length} Burn events`);

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
        // Update last scanned block for the chain, converting BigInt to number if necessary
        lastScannedBlocks[chain.chainID] = typeof endBlock === "bigint" ? Number(endBlock) : endBlock; // Update last scanned block for the chain
      } catch (error) {
        console.error(`Error processing EVM Chain ID ${chain.chainID}:`, error);
      }
    }

    // Process NEAR chains similarly
    const nearChains = Object.values(chainConfig).filter(
      (chain) => chain.networkType === NETWORK_TYPE.NEAR,
    );

    for (const chain of nearChains) {
      console.log(`Processing NEAR Chain ID: ${chain.chainID}`);

      const currentBlock = await near.getCurrentBlockNumber();
      const startBlock = lastScannedBlocks[chain.chainID] || currentBlock - 100;
      const endBlock = currentBlock;

      console.log("startBlock:", startBlock, "endBlock:", endBlock);

      try {
        const events = await near.getPastBurnRedemptionEventsInBatches(
          startBlock,
          endBlock,
          chain.aBTCAddress,
        );

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

        // Process the events and update last scanned block
        await processEventsForChain(eventMap, chain, near, DELIMITER);
        // Update last scanned block for the chain, converting BigInt to number if necessary
        lastScannedBlocks[chain.chainID] = typeof endBlock === "bigint" ? Number(endBlock) : endBlock; // Update last scanned block for the chain
      } catch (error) {
        console.error(`Error processing NEAR Chain ID ${chain.chainID}:`, error);
      }
    }

    console.log(`Last block scanned: ${JSON.stringify(lastScannedBlocks)}`);

    // Save updated last scanned blocks to file
    await saveLastScannedBlocks(lastScannedBlocks);

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
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

        console.log(`Processed record ${i}: INSERT Redemption with txn hash ${redemptionTxnHash}`);
      }
    } catch (error) {
      console.error(`Error processing record ${i}:`, error);
    }
  }
}

module.exports = { UpdateAtlasBtcRedemptions };
