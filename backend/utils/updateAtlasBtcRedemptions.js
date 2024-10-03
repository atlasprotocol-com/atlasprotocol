const { Web3 } = require("web3");

const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { getAllChainConfig } = require("./network.chain.config");
const { flagsBatch } = require("./batchFlags");

// TO FIND OUT AND DISCUSS FOR BATCH E (Fetch all EVM Burn Events and insert Redemption records in NEAR contract):
// 1. We need to have an indexer for Events to improve performance with a timestamp instead of always reading from blockchain
// 2. This current batch retrieves all Burn Events from pre-defined first block until latest block for every run

// Function to process Burn events from EVM and insert Redemption records in NEAR
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

    const evmChains = Object.values(chainConfig).filter(
      (chain) => chain.networkType === NETWORK_TYPE.EVM
    );

    // Process each EVM chain in batches
    for (const chain of evmChains) {
      console.log(`Chain ID: ${chain.chainID}, RPC URL: ${chain.chainRpcUrl}`);
      const web3 = new Web3(chain.chainRpcUrl);
      const ethereum = new Ethereum(
        chain.chainID,
        chain.chainRpcUrl,
        chain.gasLimit,
        chain.aBTCAddress,
        chain.abiPath
      );

      try {
        const endBlock = await ethereum.getCurrentBlockNumber();
        const events = await ethereum.getPastBurnEventsInBatches(
          endBlock - 1000n,
          endBlock,
          chain.batchSize
        );

        console.log(`${chain.networkName}: Found ${events.length} Burn events`);

        // Cache events and process redemptions
        const eventMap = new Map();
        for (const event of events) {
          const { returnValues, transactionHash, blockNumber } = event; // Make sure blockNumber is part of the event object
          const { wallet, btcAddress, amount } = returnValues;
        
          // Fetch the block by blockNumber to get the timestamp of the event
          const block = await web3.eth.getBlock(blockNumber);
          const timestamp = Number(block.timestamp); // The timestamp of the block where the event occurred
        
          // Set the event details in the eventMap with the timestamp
          eventMap.set(transactionHash, { wallet, btcAddress, amount, timestamp });
        }

        await processEventsForChain(eventMap, chain, near, DELIMITER);
        
      } catch (error) {
        console.error(`Error ${batchName} for Chain ID ${chain.chainID}:`, error);
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasBtcRedemptionsRunning = false;
  }
}

async function processEventsForChain(eventMap, chain, near, DELIMITER) {
  let i = 0;
  for (const [transactionHash, { wallet, btcAddress, amount, timestamp }] of eventMap.entries()) {
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
          Number(amount), // Default amount, adjust based on your needs
          timestamp,
          timestamp
        );

        console.log(`Processed record ${i}: INSERT Redemption with txn hash ${redemptionTxnHash}`);
      }
    } catch (error) {
      console.error(`Error processing record ${i}:`, error);
    }
  }
}

module.exports = { UpdateAtlasBtcRedemptions };
