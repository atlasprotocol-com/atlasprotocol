const { Web3 } = require("web3");
const _ = require("lodash");
const fs = require('fs');
const path = require('path');

const { getConstants } = require("../constants");
const {
  processMintDepositEvent,
  processBurnRedeemEvent,
  processBurnBridgeEvent,
  processMintBridgeEvent,
} = require("../helpers/eventProcessor");
const {
  getMintDepositEntities,
  getBurnRedeemEntities,
} = require("../services/subquery");
const { getUnprocessedEventsByNetworkType } = require('../helpers/atbtcEventsHelper');

// Read and parse ABI file explicitly
const atBTCAbi = JSON.parse(fs.readFileSync(path.join(__dirname, '../../contract/artifacts/atBTC.abi'), 'utf8'));

const { flagsBatch } = require("./batchFlags");

const batchName = `Batch O RetrieveAndProcessPastEvmEvents`;

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

    const { NETWORK_TYPE } = getConstants();

    const web3 = new Web3();

    // Use the new helper to get unprocessed events
    const events = await getUnprocessedEventsByNetworkType(NETWORK_TYPE.EVM);

    for (const event of events) {
      const topicsArray = event.topics.split(',');
      if (topicsArray[0] === '0x32dd79c076d214468c853220a3c326a3ba8b2d26491388e9f124955f05dee517') {
        console.log(`${batchName} Processing BurnBridge event: ${event.transaction_hash}`);
        const burnBridgeAbi = atBTCAbi.find(
          (item) => item.type === 'event' && item.name === 'BurnBridge'
        );

        const decoded = web3.eth.abi.decodeLog(
          burnBridgeAbi.inputs,
          event.data,
          topicsArray.slice(1)
        );

        const timestamp = Number(event.block_timestamp);

        await processBurnBridgeEvent({ returnValues: decoded, transactionHash: event.transaction_hash }, near, event.chain_id, timestamp);
        
      }
      else if (topicsArray[0] === '0x0e41a555d3c09325f1748b91e03e382e89153d916d4d6789a41524e2746fd91d') {
        const mintBridgeAbi = atBTCAbi.find(
          (item) => item.type === 'event' && item.name === 'MintBridge'
        );

        const decoded = web3.eth.abi.decodeLog(
          mintBridgeAbi.inputs,
          event.data,
          topicsArray.slice(1)
        );

        const timestamp = Number(event.block_timestamp);

        await processMintBridgeEvent({ returnValues: decoded, transactionHash: event.transaction_hash}, near, event.chain_id, timestamp);
      }
      else if (topicsArray[0] === '0xb8bdadb84da719b84d72f39a7dabc240534c4575a5ed3fe75269c19caa11aaed') {
        const mintBridgeAbi = atBTCAbi.find(
          (item) => item.type === 'event' && item.name === 'BurnRedeem'
        );

        const decoded = web3.eth.abi.decodeLog(
          mintBridgeAbi.inputs,
          event.data,
          topicsArray.slice(1)
        );

        const timestamp = Number(event.block_timestamp);
        console.log("decoded:: ", decoded);

        await processBurnRedeemEvent({ returnValues: decoded, transactionHash: event.transaction_hash}, near, event.chain_id, timestamp);
      }
      else if (topicsArray[0] === '0x5448dd0f4c23b4bed107869be9c14ffd7f38c6c3ded0eced40ef6ff7b8f3fc05') {
        console.log(`${batchName} Processing MintDeposit event: ${event.transaction_hash}`);
        const mintDepositAbi = atBTCAbi.find(
          (item) => item.type === 'event' && item.name === 'MintDeposit'
        );

        const decoded = web3.eth.abi.decodeLog(
          mintDepositAbi.inputs,
          event.data,
          topicsArray.slice(1)
        );

        await processMintDepositEvent({ returnValues: decoded, transactionHash: event.transaction_hash}, near, event.chain_id);
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (err) {
    console.error(`${batchName}: ${err.message} | ${err.stack}`);
  } finally {
    flagsBatch.RetrieveAndProcessPastEvmEventsRunning = false;
  }
}

module.exports = { RetrieveAndProcessPastEvmEvents };
