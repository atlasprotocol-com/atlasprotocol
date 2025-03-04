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
const {
  detectNetwork,
  getMintDepositEntities,
  isEnableSubquery,
} = require("../services/subquery");

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

    const { NETWORK_TYPE, DELIMITER } = getConstants();
    const chainConfig = getAllChainConfig();

    const evmChains = Object.values(chainConfig).filter(
      (chain) => chain.networkType === NETWORK_TYPE.EVM,
    );

    // Process each EVM chain in batches
    for (const chain of evmChains) {
      console.log(`${batchName} EVM: ${chain.chainID}`);

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

      console.log(`[SUBQUERY ${chain.chainID}] --------- DISABLED ---------`);
      return;

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
              await processBurnRedeemEvent(
                event,
                near,
                chain.chainID,
                DELIMITER,
                timestamp,
              );
              continue;
            }

            if (event.event === "BurnBridge") {
              await processBurnBridgeEvent(
                event,
                near,
                chain.chainID,
                timestamp,
              );
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
    console.error(`${batchName}: ${err.message} | ${err.stack}`);
  } finally {
    flagsBatch.RetrieveAndProcessPastEvmEventsRunning = false;
  }
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
        `[SUBQUERY.DEPOSIT ${chain.chainID}] ${record.btcTxnHash} --> ${record.id}`,
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

module.exports = { RetrieveAndProcessPastEvmEvents };
