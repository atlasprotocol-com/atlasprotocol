const _ = require("lodash");

const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { getChainConfig } = require("./network.chain.config");
const { flagsBatch, blockRange } = require("./batchFlags");

async function UpdateAtlasAbtcMinted(allDeposits, near) {
  const batchName = `Batch J UpdateAtlasAbtcMinted`;

  // Check if the batch is already running
  if (flagsBatch.UpdateAtlasAbtcMintedRunning) {
    console.log(`Previous ${batchName} incomplete. Will skip this run.`);
    return;
  }

  try {
    console.log(`${batchName}. Start run ...`);
    flagsBatch.UpdateAtlasAbtcMintedRunning = true;

    const { NETWORK_TYPE, DEPOSIT_STATUS } = getConstants(); // Access constants dynamically

    // Filter deposits that need to be processed
    const filteredTxns = allDeposits.filter(
      (deposit) =>
        deposit.status === DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC &&
        deposit.minted_txn_hash !== "" &&
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
      const deposits = groupedTxns[chainID];
      
      // Update status to DEP_BTC_MINTED_INTO_ABTC for all deposits
      for (const deposit of deposits) {
        await near.updateDepositMinted(
          deposit.btc_txn_hash,
          deposit.minted_txn_hash,
        );
        console.log(
          `Updated deposit status to DEP_BTC_MINTED_INTO_ABTC for btc_txn_hash: ${deposit.btc_txn_hash} with minted_txn_hash: ${deposit.minted_txn_hash}`,
        );
      }

    }
    console.log(`${batchName} completed successfully.`);
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.UpdateAtlasAbtcMintedRunning = false;
  }
}

module.exports = { UpdateAtlasAbtcMinted };
