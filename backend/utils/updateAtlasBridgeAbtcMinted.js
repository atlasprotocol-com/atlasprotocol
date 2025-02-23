const { Web3 } = require("web3");
const _ = require("lodash");

const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { getChainConfig } = require("./network.chain.config");
const { flagsBatch, blockRange } = require("./batchFlags");

const batchName = `--------- UpdateAtlasBridgeAbtcMinted ---------`;

async function UpdateAtlasBridgeAbtcMinted(allBridgings, near) {
  // Check if the batch is already running
  if (flagsBatch.UpdateAtlasBridgeAbtcMintedRunning) {
    console.log(`${batchName} is not completed yet. Will skip this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run ... ${allBridgings.length} bridgings`);
    flagsBatch.UpdateAtlasBridgeAbtcMintedRunning = true;

    const { NETWORK_TYPE, BRIDGING_STATUS } = getConstants(); // Access constants dynamically

    // Filter bridgings that need to be processed
    const filteredTxns = allBridgings.filter(
      (bridging) =>
        bridging.status ===
          BRIDGING_STATUS.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST &&
        bridging.dest_txn_hash === "" &&
        bridging.remarks === "",
    );

    // Group bridgings by receiving_chain_id
    const groupedTxns = filteredTxns.reduce((acc, bridging) => {
      if (!acc[bridging.dest_chain_id]) {
        acc[bridging.dest_chain_id] = [];
      }
      acc[bridging.dest_chain_id].push(bridging);
      return acc;
    }, {});

    // Find the earliest timestamp in the bridgings for this chain
    const earliestTimestamp = Math.min(
      ...filteredTxns.map((bridging) => bridging.timestamp),
    );

    // Process each group of bridgings by chain ID
    for (const chainID in groupedTxns) {
      const bridgings = groupedTxns[chainID];
      const chainConfig = getChainConfig(chainID);

      if (chainConfig.networkType === NETWORK_TYPE.EVM) {
        const web3 = new Web3(chainConfig.chainRpcUrl);
        const ethereum = new Ethereum(
          chainConfig.chainID,
          chainConfig.chainRpcUrl,
          chainConfig.gasLimit,
          chainConfig.aBTCAddress,
          chainConfig.abiPath,
        );

        const startBlock =
          await ethereum.getBlockNumberByTimestamp(earliestTimestamp);
        console.log(`${batchName} startBlock: ${startBlock}`);

        const endBlock = await ethereum.getCurrentBlockNumber();
        console.log(`${batchName} endBlock: ${endBlock}`);

        const events = await ethereum.getPastMintBridgeEventsInBatches(
          startBlock - 1n,
          endBlock,
          blockRange(Number(chainConfig.batchSize)),
        );

        // Loop through bridgings and match them with the events
        for (const bridging of bridgings) {
          // Fetch Mint events for this chain
          try {
            const matchingEvent = events.find(
              (event) => event.returnValues.originTxnHash === bridging.txn_hash,
            );

            if (matchingEvent) {
              const block = await web3.eth.getBlock(matchingEvent.blockNumber);
              const timestamp = Number(block.timestamp); // The timestamp of the block where the event occurred

              const { transactionHash } = matchingEvent;
              await near.updateBridgingMinted(
                bridging.txn_hash,
                transactionHash,
                timestamp,
              );
              console.log(
                `${batchName} Updated bridging for txn_hash: ${bridging.txn_hash} with transactionHash: ${transactionHash}`,
              );
            } else {
              console.log(
                `${batchName} No matching event found for txn_hash: ${bridging.txn_hash}`,
              );
            }
          } catch (error) {
            const remarks = `${batchName} Error fetching or processing events for txn_hash: ${bridging.txn_hash}: ${error.message}`;
            console.error(remarks);
            // Log the error in the first bridging’s remarks
            await near.updateBridgingRemarks(bridging.txn_hash, remarks);
            continue; // Continue to the next chain group
          }
        }
      } else if (chainConfig.networkType === NETWORK_TYPE.NEAR) {
        const startBlock =
          await near.getBlockNumberByTimestamp(earliestTimestamp);
        console.log(`${batchName} startBlock: ${startBlock}`);

        const currentBlock = await near.getCurrentBlockNumber();
        console.log(`${batchName} currentBlock: ${currentBlock}`);

        const events = await near.getPastMintBridgeEventsInBatches(
          startBlock - 1,
          currentBlock,
        );

        for (let bridging of bridgings) {
          try {
            const matchingEvent = events.find(
              (event) => event.originTxnHash === bridging.txn_hash,
            );

            if (matchingEvent) {
              const { transactionHash, timestamp } = matchingEvent;
              await near.updateBridgingMinted(
                bridging.txn_hash,
                transactionHash,
                Math.floor(timestamp / 1000000),
              );
              console.log(
                `${batchName} Updated deposit for txn_hash: ${bridging.txn_hash} with transactionHash: ${transactionHash}`,
              );
            }
          } catch (error) {
            const remarks = `${batchName} Error fetching or processing events for txn_hash: ${bridging.txn_hash}: ${error.message}`;
            console.error(remarks);
            // Log the error in the first deposit’s remarks
            await near.updateBridgingRemarks(bridging.txn_hash, remarks);
            continue; // Continue to the next chain group
          }
        }
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`${batchName}: Error `, error);
  } finally {
    flagsBatch.UpdateAtlasBridgeAbtcMintedRunning = false;
  }
}

module.exports = { UpdateAtlasBridgeAbtcMinted };
