const { getConstants } = require("../constants");
const { insertNearEventToAtbtcEvents } = require("../helpers/atbtcEventsHelper");

const { flagsBatch } = require("./batchFlags");
const { getAllChainConfig } = require("./network.chain.config");
const {
  setBlockCursor,
  getBlockCursor,
} = require("./batchTime/lastScannedBlockHelper");

const batchName = "Batch X NearChainScanner";


async function nearChainScanner(
  near
) {
  if (flagsBatch.NearChainScanner) {
    console.log(`${batchName} is not completed yet. Will skip this run.`);
    return;
  }

  console.log(`${batchName} Start run ...`);
  flagsBatch.NearChainScannerRunning = true;

  const { NETWORK_TYPE } = getConstants();
  const chainConfig = getAllChainConfig();

  const batchSize = 50;

  try {
    const chain = Object.values(chainConfig).find(
      (chain) => chain.networkType === NETWORK_TYPE.NEAR
    );

    if (!chain) {
      throw new Error('No NEAR chain configuration found');
    }

    console.log(
      `${batchName} Chain ID: ${chain.chainID}, aBTC: ${chain.aBTCAddress}, RPC URL: ${chain.chainRpcUrl}`,
    );

    const endBlock = await near.getCurrentBlockNumber();
    
    const startBlock = await getBlockCursor(
      "NearChainScanner",
      chain.chainID + "_NearChainScanner",
      endBlock,
    );
    const toBlock = Math.min(startBlock + batchSize, endBlock);
    
    // Diagnostic logging for block range
    const blocksBehind = endBlock - startBlock;
    const percentageFromLatest = ((startBlock / endBlock) * 100).toFixed(4);
    console.log(`${batchName} Block Range Details: Current block: ${endBlock}, Start block: ${startBlock}, To block: ${toBlock}, Block range size: ${toBlock - startBlock}`);
    console.log(`${batchName} Progress: ${blocksBehind} blocks behind (${percentageFromLatest}% of latest block)`);

    // Get all events
    const events = await near.getPastEventsInBatches(
      startBlock,
      toBlock,
      chain.aBTCAddress,
    );


    console.log(`${batchName} Found ${events.length} total events in block: ${startBlock}`);
    
    // Process all events in a single loop
    for (const event of events) {
      
      event.chainID = chain.chainID;
      event.networkType = chain.networkType;
      event.address = chain.aBTCAddress;
      await insertNearEventToAtbtcEvents(event);
    }

    await setBlockCursor(
      "NearChainScanner",
      chain.chainID + "_NearChainScanner",
      toBlock,
    );
  } catch (error) {
    console.error(`${batchName} ERROR: ${error.message} | ${error.stack}`);
  }

  console.log(`${batchName} completed successfully.`);
  flagsBatch.NearChainScannerRunning = false;
}

module.exports = { nearChainScanner };
