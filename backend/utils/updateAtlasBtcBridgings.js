const { Web3 } = require("web3");

const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { getAllChainConfig } = require("./network.chain.config");
const { flagsBatch, blockRange } = require("./batchFlags");
const {
  setBlockCursor,
  getBlockCursor,
} = require("./batchTime/lastScannedBlockHelper");

// TO FIND OUT AND DISCUSS FOR BATCH E (Fetch all EVM Burn Events and insert Redemption records in NEAR contract):
// 1. We need to have an indexer for Events to improve performance with a timestamp instead of always reading from blockchain
// 2. This current batch retrieves all Burn Events from pre-defined first block until latest block for every run

// Function to process Burn events from EVM and insert Redemption records in NEAR
const batchName = "---------- UpdateAtlasBtcBridgings----------";
async function UpdateAtlasBtcBridgings(near) {
  if (flagsBatch.UpdateAtlasBtcBridgings) {
    console.log(`${batchName} is not completed yet. Will skip this run.`);
    return;
  }

  console.log(`${batchName} Start run ...`);
  flagsBatch.UpdateAtlasBtcBridgings = true;

  const { BRIDGING_STATUS, NETWORK_TYPE, DELIMITER } = getConstants();
  const chainConfig = getAllChainConfig();

  try {
    const evmChains = Object.values(chainConfig).filter(
      (chain) => chain.networkType === NETWORK_TYPE.EVM,
    );

    // Process each EVM chain in batches
    for (const chain of evmChains) {
      console.log(
        `${batchName} Chain ID: ${chain.chainID}, aBTC: ${chain.aBTCAddress}, RPC URL: ${chain.chainRpcUrl}`,
      );
      const web3 = new Web3(chain.chainRpcUrl);
      const ethereum = new Ethereum(
        chain.chainID,
        chain.chainRpcUrl,
        chain.gasLimit,
        chain.aBTCAddress,
        chain.abiPath,
      );
      const endBlock = await ethereum.getCurrentBlockNumber();
      console.log(`${batchName} endBlock: ${endBlock}`);

      const startBlock = await getBlockCursor(
        "UpdateAtlasBtcBridgings",
        chain.chainID,
        endBlock,
      );
      console.log(`${batchName} startBlock: ${startBlock}`);

      const events = await ethereum.getPastBurnBridgingEventsInBatches(
        BigInt(startBlock - 100),
        endBlock,
        // BigInt(126296064 - 10),
        // BigInt(126296064 + 10),
        blockRange(Number(chain.batchSize)),
      );

      console.log(
        `${batchName} Chain ID: ${chain.chainID}, Fetched ${events.length} events from ${endBlock} to ${endBlock}`,
      );

      // Cache events and process
      const records = [];
      for (const event of events) {
        const {
          returnValues: { wallet, destChainId, destChainAddress, amount, mintingFeeSat, bridgingFeeSat },
          transactionHash,
          blockNumber,
        } = event; // Make sure blockNumber is part of the event object

        let bridgingTxnHash = `${chain.chainID}${DELIMITER.COMMA}${transactionHash}`;

        const block = await web3.eth.getBlock(blockNumber);
        let timestamp = Number(block.timestamp);

        // Create the BridgingRecord object
        const record = {
          txn_hash: bridgingTxnHash,
          origin_chain_id: chain.chainID,
          origin_chain_address: wallet,
          dest_chain_id: destChainId,
          dest_chain_address: destChainAddress,
          dest_txn_hash: "",
          abtc_amount: Number(amount),
          timestamp: timestamp,
          status: 0,
          remarks: "",
          date_created: timestamp,
          verified_count: 0,
          minting_fee_sat: Number(mintingFeeSat),
          yield_provider_gas_fee: Number(bridgingFeeSat),
        };

        // Fetch the transaction receipt to check the status
        const receipt = await web3.eth.getTransactionReceipt(transactionHash);
        if (receipt.status) {
          record.status = BRIDGING_STATUS.ABTC_BURNT;
        }

        records.push(record);
      }

      await processEventsForChain(records, near, BRIDGING_STATUS);
      await setBlockCursor("UpdateAtlasBtcBridgings", chain.chainID, endBlock);
    }
  } catch (error) {
    console.error(`${batchName} EVM.ERROR ${error.message} | ${error.stack}`);
  }

  console.log(`${batchName} completed successfully.`);
  flagsBatch.UpdateAtlasBtcBridgings = false;
}

async function processEventsForChain(records, near, BRIDGING_STATUS) {
  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    try {
      const exist = await near.getBridgingByTxnHash(record.txn_hash);
      if (exist) {
        console.log(
          `[${record.txn_hash}]: EXIST ${record.origin_chain_id} -> ${record.dest_chain_id} | status:${exist.status}`,
        );
        if (
          exist.status === BRIDGING_STATUS.ABTC_PENDING_BURNT &&
          record.status === BRIDGING_STATUS.ABTC_BURNT
        ) {
          console.log(
            `${batchName} [${record.txn_hash}]: UPDATE Bridging record ${i}`,
          );
          await near.updateBridgingBtcBridged(record);
        }

        continue;
      }

      await near.insertBridgingAbtc(record);
      console.log(
        `${batchName} [${record.txn_hash}]: INSERT Bridging record ${i}`,
      );
    } catch (error) {
      console.error(
        `${batchName} [${record.txn_hash}]: Error processing record ${i}:`,
        error,
      );
    }
  }
}

module.exports = { UpdateAtlasBtcBridgings };
