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
const {
  processMintDepositEvent,
  processBurnRedeemEvent,
  processBurnBridgeEvent,
  processMintBridgeEvent,
} = require("../helpers/eventProcessor");

const batchName = `Batch RetrieveAndProcessPastEvmEvents`;

async function RetrieveAndProcessPastEvmEvents(
  near,
  allDeposits,
  allRedemptions,
  allBridgings,
) {
  if (flagsBatch.RetrieveAndProcessPastEvmEventsRunning) {
    console.log(`${batchName} Batch is not incomplete. Will skip this run.`);
    return;
  }

  try {
    console.log(`${batchName} Start run ...`);
    flagsBatch.RetrieveAndProcessPastEvmEventsRunning = true;

    const { NETWORK_TYPE, DELIMITER, DEPOSIT_STATUS, BRIDGING_STATUS } =
      getConstants();
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
        "RetrieveAndProcessPastEvmEvents",
        chain.chainID,
        endBlock,
      );

      console.log(
        `${batchName} EVM: ${chain.chainID} startBlock: ${startBlock} endBlock: ${endBlock}`,
      );

      try {
        const events = await ethereum.getPastEventsInBatches(
          startBlock - 10,
          endBlock,
          blockRange(Number(chainConfig.batchSize)),
          chain.aBTCAddress,
        );

        console.log(
          `${batchName} ${chain.networkName}: Found ${events.length} total events`,
        );

        for (const event of events) {
          try {
            const block = await web3.eth.getBlock(event.blockNumber);
            const timestamp = Number(block.timestamp);

            console.log(event);

            if (event.event === "MintDeposit") {
              await processMintDepositEvent(event, near);
              continue;
            }

            if (event.event === "BurnRedeem") {
              await processBurnRedeemEvent(event, near, chain.chainID, DELIMITER, timestamp);
              continue;
            }

            if (event.event === "BurnBridge") {
              await processBurnBridgeEvent(event, near, chain.chainID, timestamp);
              continue;
            }

            if (event.event === "MintBridge") {
              await processMintBridgeEvent(event, near, timestamp);
              continue;
            }
          } catch (error) {
            console.error(`${batchName} Error processing event:`, error);
          }
        }

        setBlockCursor(
          "RetrieveAndProcessPastEvmEvents",
          chain.chainID,
          endBlock,
        );
      } catch (error) {
        console.error(`${batchName} ${chain.chainID}: ${error.message}`);
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (err) {
    console.error(`${batchName}: ${err.message}`);
  } finally {
    flagsBatch.RetrieveAndProcessPastEvmEventsRunning = false;
  }
}

module.exports = { RetrieveAndProcessPastEvmEvents };
