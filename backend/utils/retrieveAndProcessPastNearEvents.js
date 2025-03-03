const { getConstants } = require("../constants");

const { getAllChainConfig } = require("./network.chain.config");
const { flagsBatch } = require("./batchFlags");
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

const batchName = "---------- RetrieveAndProcessPastNearEvents ----------";

async function RetrieveAndProcessPastNearEvents(
  near,
  deposits,
  redemptions,
  bridgings,
) {
  if (flagsBatch.RetrieveAndProcessPastNearEvents) {
    console.log(`${batchName} is not completed yet. Will skip this run.`);
    return;
  }

  console.log(`${batchName} Start run ...`);
  flagsBatch.RetrieveAndProcessPastNearEvents = true;

  const { BRIDGING_STATUS, NETWORK_TYPE, DELIMITER, DEPOSIT_STATUS } =
    getConstants();
  const chainConfig = getAllChainConfig();

  try {
    const nearChains = Object.values(chainConfig).filter(
      (chain) => chain.networkType === NETWORK_TYPE.NEAR,
    );

    for (const chain of nearChains) {
      console.log(
        `${batchName} Chain ID: ${chain.chainID}, aBTC: ${chain.aBTCAddress}, RPC URL: ${chain.chainRpcUrl}`,
      );

      const endBlock = await near.getCurrentBlockNumber();
      console.log(`${batchName} endBlock: ${endBlock}`);

      const startBlock = await getBlockCursor(
        "RetrieveAndProcessPastNearEvents",
        chain.chainID,
        endBlock,
      );
      console.log(`${batchName} startBlock: ${startBlock}`);

      // Get all events
      const events = await near.getPastEventsInBatches(
        startBlock - 10,
        endBlock,

        // 188551586 - 10,
        // 188551586 + 10,
        chain.aBTCAddress,
      );

      console.log(`${batchName} Found ${events.length} total events`);

      // Process all events in a single loop
      for (const event of events) {
        try {
          const timestamp = event.timestamp;
          console.log(event);
          if (event.type === "mint_redemption") {
            await processMintDepositEvent(event, near);
          } else if (event.type === "burn_bridging") {
            await processBurnBridgeEvent(
              {
                returnValues: {
                  wallet: event.returnValues.wallet,
                  destChainId: event.returnValues.destChainId,
                  destChainAddress: event.returnValues.destChainAddress,
                  amount: event.returnValues.amount,
                  mintingFeeSat: event.returnValues.mintingFeeSat,
                  bridgingFeeSat: event.returnValues.bridgingFeeSat,
                },
                transactionHash: event.transactionHash,
              },
              near,
              chain.chainID,
              timestamp,
            );
          } else if (event.type === "burn_redemption") {
            await processBurnRedeemEvent(
              {
                returnValues: {
                  wallet: event.returnValues.wallet,
                  btcAddress: event.returnValues.btcAddress,
                  amount: event.returnValues.amount,
                },
                transactionHash: event.transactionHash,
              },
              near,
              chain.chainID,
              DELIMITER,
              timestamp,
            );
          } else if (event.type === "mint_bridge") {
            await processMintBridgeEvent(
              {
                returnValues: { originTxnHash: event.originTxnHash },
                transactionHash: event.transactionHash,
              },
              near,
              timestamp,
            );
          }
        } catch (error) {
          console.error(
            `${batchName} Error processing ${event.type} event:`,
            error,
          );
        }
      }

      await setBlockCursor(
        "RetrieveAndProcessPastNearEvents",
        chain.chainID,
        endBlock,
      );
    }
  } catch (error) {
    console.error(`${batchName} ERROR: ${error.message} | ${error.stack}`);
  }

  console.log(`${batchName} completed successfully.`);
  flagsBatch.RetrieveAndProcessPastNearEvents = false;
}

module.exports = { RetrieveAndProcessPastNearEvents };
