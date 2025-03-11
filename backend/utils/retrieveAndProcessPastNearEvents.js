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
const {
  detectNetwork,
  getMintDepositEntities,
  isEnableSubquery,
  getBurnRedeemEntities,
} = require("../services/subquery");

const batchName = "---------- RetrieveAndProcessPastNearEvents ----------";

async function RetrieveAndProcessPastNearEvents(
  near,
  allDeposits,
  allRedemptions,
  allBridgings,
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

      if (isEnableSubquery()) {
        const network = detectNetwork(chain.chainRpcUrl);

        if (network) {
          console.log(
            `[SUBQUERY ${chain.chainID} ${network}] --------- ENABLED ---------`,
          );

          await doWithSubquery(
            chain,
            network,
            near,
            allDeposits,
            allRedemptions,
            allBridgings,
          );
          continue;
        }
      }

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

async function doWithSubquery(
  chain,
  network,
  near,
  allDeposits,
  allRedemptions,
  allBridgings,
) {
  await doWithSubqueryForDeposits(chain, network, near, allDeposits);
  await doWithSubqueryForRedeems(chain, network, near, allRedemptions);
}

async function doWithSubqueryForDeposits(chain, network, near, allDeposits) {
  const { DEPOSIT_STATUS } = getConstants();

  // Filter deposits that need to be processed
  const filteredTxns = allDeposits.filter(
    (deposit) =>
      deposit.status === DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC &&
      deposit.minted_txn_hash === "" &&
      deposit.remarks === "" &&
      deposit.receiving_chain_id === chain.chainID,
  );
  const records = await getMintDepositEntities(
    network,
    filteredTxns.map((deposit) => deposit.btc_txn_hash),
  );

  const recordMaps = records.reduce(
    (maps, record) => ({ ...maps, [record.btcTxnHash]: record }),
    {},
  );

  for (let deposit of filteredTxns) {
    if (recordMaps[deposit.btc_txn_hash]) {
      const record = recordMaps[deposit.btc_txn_hash];
      console.log(
        `[SUBQUERY.DEPOSIT ${network} ${chain.chainID}] ${record.btcTxnHash} --> ${record.id}`,
      );

      try {
        await near.updateDepositMintedTxnHash(record.btcTxnHash, record.id);
      } catch (error) {
        const remarks = `[${batchName}] ${deposit.btc_txn_hash}: ${error.message}`;
        console.error(remarks);
        await near.updateDepositRemarks(deposit.btc_txn_hash, remarks);
      }
    }
  }
}

async function doWithSubqueryForRedeems(chain, network, near, allRedemptions) {
  const { DELIMITER } = getConstants();

  const ids = allRedemptions
    .map((redeem) => {
      const parts = redeem.txn_hash.split(",");
      return parts.length > 1 ? parts[1] : null;
    })
    .filter(Boolean);
  if (ids.length === 0) {
    console.log(`[SUBQUERY.DEPOSIT ${network} ${chain.chainID}] NO_REDEEM_IDS`);
    return;
  }

  const records = await getBurnRedeemEntities(network, ids);

  for (let redeemp of records) {
    const txhash = `${chain.chainID}${DELIMITER.COMMA}${redeemp.id}`;
    const redemptionRecord = await near.getRedemptionByTxnHash(txhash);
    const timestamp =
      Number(redeemp.timestamp) || Math.round(Date.now() / 1000);

    if (!redemptionRecord) {
      await near.insertRedemptionAbtc(
        txhash,
        redeemp.accountAddress,
        chain.chainID,
        redeemp.btcAddress,
        Number(redeemp.btcAmount),
        timestamp,
        timestamp,
      );

      console.log(
        `[SUBQUERY.REDEEMP ${network} ${chain.chainID}] ${redeemp.btcAddress} --> ${redeemp.id}`,
      );
    }
  }
}

module.exports = { RetrieveAndProcessPastNearEvents };
