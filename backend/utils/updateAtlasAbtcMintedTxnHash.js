const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { getChainConfig } = require("./network.chain.config");
const { flagsBatch } = require("./batchFlags");
const {
  getMintDepositEntities,
  detectNetwork,
} = require("../services/subquery");

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

    const { DEPOSIT_STATUS } = getConstants(); // Access constants dynamically

    // Filter deposits that need to be processed
    const filteredTxns = allDeposits.filter(
      (deposit) =>
        deposit.status === DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC &&
        deposit.minted_txn_hash === "" &&
        deposit.remarks === "",
    );

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
      const chainConfig = getChainConfig(chainID);
      const network = detectNetwork(chainConfig.chainRpcUrl);
      if (!network) continue;

      const deposits = groupedTxns[chainID];
      const records = await getMintDepositEntities(
        network,
        deposits.map((deposit) => deposit.btc_txn_hash),
      );

      const recordMaps = records.reduce(
        (maps, record) => ({ ...maps, [record.btcTxnHash]: record }),
        {},
      );

      for (let deposit of deposits) {
        if (recordMaps[deposit.btc_txn_hash]) {
          const record = recordMaps[deposit.btc_txn_hash];
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

    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasAbtcMintedTxnHashRunning = false;
  }
}

module.exports = { UpdateAtlasAbtcMintedTxnHash };
