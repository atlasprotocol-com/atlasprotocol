const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { getChainConfig } = require("./network.chain.config");
const { flagsBatch } = require("./batchFlags");

async function UpdateAtlasAbtcMintedTxnHash(allDeposits, near) {
  const batchName = `Batch J UpdateAtlasAbtcMintedTxnHash`;

  // Check if the batch is already running
  if (flagsBatch.UpdateAtlasAbtcMintedTxnHashRunning) {
    console.log(`Previous ${batchName} incomplete. Will skip this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasAbtcMintedTxnHashRunning = true;

    const { NETWORK_TYPE, DEPOSIT_STATUS } = getConstants(); // Access constants dynamically

    // Filter deposits that need to be processed
    const filteredTxns = allDeposits.filter(
      (deposit) =>
        deposit.status === DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC &&
        deposit.minted_txn_hash === "" &&
        deposit.remarks === "",
    ).slice(0, 1);

    // Group deposits by receiving_chain_id
    const groupedTxns = filteredTxns.reduce((acc, deposit) => {
      if (!acc[deposit.receiving_chain_id]) {
        acc[deposit.receiving_chain_id] = [];
      }
      acc[deposit.receiving_chain_id].push(deposit);
      return acc;
    }, {});

    // Process each group of deposits by chain ID
    for (const chainID in groupedTxns) {
      const deposits = groupedTxns[chainID];
      const chainConfig = getChainConfig(chainID);
      
      if (chainConfig.networkType === NETWORK_TYPE.EVM) {
        const ethereum = new Ethereum(
          chainConfig.chainID,
          chainConfig.chainRpcUrl,
          chainConfig.gasLimit,
          chainConfig.aBTCAddress,
          chainConfig.abiPath,
        );

        // Find the earliest timestamp in the deposits for this chain
        const earliestTimestamp = Math.min(
          ...deposits.map((deposit) => deposit.timestamp),
        );

        const startBlock =
          await ethereum.getBlockNumberByTimestamp(earliestTimestamp);

        const events = await ethereum.getPastMintEventsInBatches(
          startBlock - 2,
          startBlock + 2,
          chainConfig.batchSize,
        );

        // Loop through deposits and match them with the events
        for (const deposit of deposits) {
          // Fetch Mint events for this chain
          try {
            const matchingEvent = events.find(
              (event) => event.returnValues.btcTxnHash === deposit.btc_txn_hash,
            );

            if (matchingEvent) {
              const { transactionHash } = matchingEvent;
              await near.updateDepositMintedTxnHash(
                deposit.btc_txn_hash,
                transactionHash,
              );
              console.log(
                `Updated deposit for btc_txn_hash: ${deposit.btc_txn_hash} with transactionHash: ${transactionHash}`,
              );
            }
          } catch (error) {
            const remarks = `Error ${batchName} fetching or processing events for btc_txn_hash: ${deposit.btc_txn_hash}: ${error.message}`;
            console.error(remarks);
            // Log the error in the first deposit’s remarks
            await near.updateDepositRemarks(deposit.btc_txn_hash, remarks);
            continue; // Continue to the next chain group
          }
        }
      } else if (chainConfig.networkType === NETWORK_TYPE.NEAR) {

        // Find the earliest timestamp in the deposits for this chain
        const earliestTimestamp = Math.min(
          ...deposits.map((deposit) => deposit.timestamp),
        );

        const startBlock = await near.getBlockNumberByTimestamp(earliestTimestamp);

        
        const events = await near.getPastMintEventsInBatches(
          startBlock - 2,
          startBlock + 2,
        );

        for (const deposit of deposits) {
          try {
            const matchingEvent = events.find(
              (event) => event.btcTxnHash === deposit.btc_txn_hash,
            );

            if (matchingEvent) {
              const { transactionHash } = matchingEvent;
              await near.updateDepositMintedTxnHash(
                deposit.btc_txn_hash,
                transactionHash,
              );
              console.log(
                `Updated deposit for btc_txn_hash: ${deposit.btc_txn_hash} with transactionHash: ${transactionHash}`,
              );
            }
          } catch (error) {
            const remarks = `Error ${batchName} fetching or processing events for btc_txn_hash: ${deposit.btc_txn_hash}: ${error.message}`;
            console.error(remarks);
            // Log the error in the first deposit’s remarks
            await near.updateDepositRemarks(deposit.btc_txn_hash, remarks);
            continue; // Continue to the next chain group
          }
        }
      }
    }

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasAbtcMintedTxnHashRunning = false;
  }
}

module.exports = { UpdateAtlasAbtcMintedTxnHash }; 