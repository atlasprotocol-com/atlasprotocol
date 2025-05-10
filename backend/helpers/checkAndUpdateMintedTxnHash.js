const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");
const { getChainConfig } = require("../utils/network.chain.config");

const { processMintDepositEvent } = require("./eventProcessor");

async function checkAndUpdateMintedTxnHash(btcTxnHash, near, mintedTxnHash) {
  const { NETWORK_TYPE, DEPOSIT_STATUS, EVENT_NAME } = getConstants();

  try {
    // First get the deposit record
    const depositRecord = await near.getDepositByBtcTxnHash(btcTxnHash);

    if (!depositRecord) {
      console.log(`No deposit record found for btcTxnHash: ${btcTxnHash}`);
      return false;
    }

    // Check deposit status and fields
    if (
      !(
        depositRecord.status === DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC &&
        depositRecord.minted_txn_hash === "" &&
        depositRecord.remarks === ""
      )
    ) {
      console.log(
        `Deposit record not in correct state for btcTxnHash: ${btcTxnHash}`,
      );
      return false;
    }

    console.log(depositRecord);

    // Get the chain config for the deposit's receiving chain
    const chainConfig = getChainConfig(depositRecord.receiving_chain_id);

    console.log(chainConfig);

    if (!chainConfig) {
      console.log(
        `No chain config found for chain ID: ${depositRecord.receiving_chain_id}`,
      );
      return false;
    }

    let matchingEvent;

    if (chainConfig.networkType === NETWORK_TYPE.EVM) {
      // For EVM chains
      const ethereum = new Ethereum(
        chainConfig.chainID,
        chainConfig.chainRpcUrl,
        chainConfig.gasLimit,
        chainConfig.aBTCAddress,
        chainConfig.abiPath,
      );

      // Fetch event using mintedTxnHash
      const event = await ethereum.fetchEventByTxnHashAndEventName(mintedTxnHash, EVENT_NAME.MINT_DEPOSIT);

      if (!event) {
        console.log(`No mint deposit event found for mintedTxnHash: ${mintedTxnHash}`);
        return false;
      }

      // Process the event
      await processMintDepositEvent(event, near);
      return true;

    } else if (chainConfig.networkType === NETWORK_TYPE.NEAR) {
      const events = await near.getPastEventsByMintedTxnHash(mintedTxnHash);

      // Find matching event
      matchingEvent = events.find(
        (event) => event.btcTxnHash === btcTxnHash,
      );
    }

    if (matchingEvent) {
      console.log(matchingEvent);
      await processMintDepositEvent(matchingEvent, near);
      return true;
    }

    console.log(
      `No matching event found for btcTxnHash: ${btcTxnHash} on chain: ${chainConfig.chainID}`,
    );
    return false;
  } catch (error) {
    console.error(
      `Error checking minted transaction hash for btcTxnHash: ${btcTxnHash}:`,
      error,
    );
    return false;
  }
}

module.exports = {
  checkAndUpdateMintedTxnHash,
};
