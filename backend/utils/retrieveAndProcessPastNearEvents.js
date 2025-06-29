const { getConstants } = require("../constants");
const {
  processMintDepositEvent,
  processBurnRedeemEvent,
  processBurnBridgeEvent,
  processMintBridgeEvent,
} = require("../helpers/eventProcessor");
const { getUnprocessedEventsByNetworkType } = require("../helpers/atbtcEventsHelper");

const { flagsBatch } = require("./batchFlags");

const batchName = "Batch P RetrieveAndProcessPastNearEvents";

async function RetrieveAndProcessPastNearEvents(
  near,
  allDeposits,
  allRedemptions,
  allBridgings,
) {
  if (flagsBatch.RetrieveAndProcessPastNearEventsRunning) {
    console.log(`${batchName} is not completed yet. Will skip this run.`);
    return;
  }

  console.log(`${batchName} Start run ...`);
  flagsBatch.RetrieveAndProcessPastNearEventsRunning = true;

  const { NETWORK_TYPE } = getConstants();

  try {
    const events = await getUnprocessedEventsByNetworkType(NETWORK_TYPE.NEAR);
    console.log("[getUnprocessedEventsByNetworkType] events:: ", events);
    for (const event of events) {

      const parsedData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

      if (event.topics === "mint_bridge") {
        console.log("[RetrieveAndProcessPastNearEvents] event.data:: ", parsedData);
        await processMintBridgeEvent(
          {
            returnValues: parsedData,
            transactionHash: event.transaction_hash,
          },
          near,
          event.chain_id,
          Number(event.block_timestamp)
        );
        
      } else if (event.topics === "burn_bridging") {
        await processBurnBridgeEvent(
          {
            returnValues: parsedData,
            transactionHash: event.transaction_hash,
          },
          near,
          event.chain_id,
          Number(event.block_timestamp),
        );
      } else if (event.topics === "burn_redemption") {
        await processBurnRedeemEvent(
          {
            returnValues: parsedData,
            transactionHash: event.transaction_hash,
          },
          near,
          event.chain_id,
          Number(event.block_timestamp),
        );
      } else if (event.topics === "mint_deposit") {
        await processMintDepositEvent(
          {
            returnValues: parsedData,
            transactionHash: event.transaction_hash,
          },
          near,
          event.chain_id,
        );
      }
    }

    // for (const chain of nearChains) {
    //   console.log(
    //     `${batchName} Chain ID: ${chain.chainID}, aBTC: ${chain.aBTCAddress}, RPC URL: ${chain.chainRpcUrl}`,
    //   );
    //   if (isEnableSubquery()) {
    //     const network = detectNetwork(chain.chainRpcUrl);
    //     if (network) {
    //       console.log(
    //         `[SUBQUERY ${chain.chainID} ${network}] --------- ENABLED ---------`,
    //       );

    //       await doWithSubquery(
    //         chain,
    //         network,
    //         near,
    //         allDeposits,
    //         allRedemptions,
    //         allBridgings,
    //       );
    //       continue;
    //     }
    //   }

    //   const endBlock = await near.getCurrentBlockNumber();
    //   console.log(`${batchName} endBlock: ${endBlock}`);

    //   const startBlock = await getBlockCursor(
    //     "RetrieveAndProcessPastNearEventsRunning",
    //     chain.chainID,
    //     endBlock,
    //   );
    //   console.log(`${batchName} startBlock: ${startBlock}`);

    //   // Get all events
    //   const events = await near.getPastEventsInBatches(
    //     startBlock,
    //     endBlock,

    //     // 188551586 - 10,
    //     // 188551586 + 10,
    //     chain.aBTCAddress,
    //   );

    //   console.log(`${batchName} Found ${events.length} total events`);

    //   // Process all events in a single loop
    //   for (const event of events) {
    //     try {
    //       const timestamp = event.timestamp;
    //       console.log(event);
    //       if (event.type === "mint_deposit") {
    //         await processMintDepositEvent(event, near);
    //       } else if (event.type === "burn_bridging") {
    //         await processBurnBridgeEvent(
    //           {
    //             returnValues: {
    //               wallet: event.returnValues.wallet,
    //               destChainId: event.returnValues.destChainId,
    //               destChainAddress: event.returnValues.destChainAddress,
    //               amount: event.returnValues.amount,
    //               mintingFeeSat: event.returnValues.mintingFeeSat,
    //               bridgingFeeSat: event.returnValues.bridgingFeeSat,
    //             },
    //             transactionHash: event.transactionHash,
    //           },
    //           near,
    //           chain.chainID,
    //           timestamp,
    //         );
    //       } else if (event.type === "burn_redemption") {
    //         // Check if amount is greater than 10000
    //         if (Number(event.returnValues.amount) < 10000) {
    //           console.log("Amount is less than 10000, skipping...");
    //           continue;
    //         }

    //         await processBurnRedeemEvent(
    //           {
    //             returnValues: {
    //               wallet: event.returnValues.wallet,
    //               btcAddress: event.returnValues.btcAddress,
    //               amount: event.returnValues.amount,
    //             },
    //             transactionHash: event.transactionHash,
    //           },
    //           near,
    //           chain.chainID,
    //           DELIMITER,
    //           timestamp,
    //         );
    //       } else if (event.type === "mint_bridge") {
    //         await processMintBridgeEvent(
    //           {
    //             returnValues: { originTxnHash: event.originTxnHash },
    //             transactionHash: event.transactionHash,
    //           },
    //           near,
    //           timestamp,
    //         );
    //       }
    //     } catch (error) {
    //       console.error(
    //         `${batchName} Error processing ${event.type} event:`,
    //         error,
    //       );
    //     }
    //   }

    //   await setBlockCursor(
    //     "RetrieveAndProcessPastNearEventsRunning",
    //     chain.chainID,
    //     endBlock,
    //   );
    // }
  } catch (error) {
    console.error(`${batchName} ERROR: ${error.message} | ${error.stack}`);
  }

  console.log(`${batchName} completed successfully.`);
  flagsBatch.RetrieveAndProcessPastNearEventsRunning = false;
}

module.exports = { RetrieveAndProcessPastNearEvents };
