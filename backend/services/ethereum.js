const { Web3 } = require("web3");
const { bytesToHex } = require("@ethereumjs/util");
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const pRetry = require("p-retry");

const { getConstants } = require("../constants");
const address = require("./address");

const {
  deriveChildPublicKey,
  najPublicKeyStrToUncompressedHexPoint,
  uncompressedHexPointToEvmAddress,
} = require("./kdf");

const { EVENT_NAME } = getConstants(); // Access constants dynamically

class Ethereum {
  constructor(chainID, rpcUrl, gasLimit, aBTCAddress, abiPath) {
    this.contractABI = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, abiPath), "utf-8"),
    );

    this.web3 = new Web3(rpcUrl);

    this.abtcContract = new this.web3.eth.Contract(
      this.contractABI,
      aBTCAddress,
    );

    this.chainID = Number(chainID);
    this.gasLimit = gasLimit;
    this.aBTCAddress = aBTCAddress;
  }

  async queryGasPrice() {
    const maxFeePerGas = await this.web3.eth.getGasPrice();
    const maxPriorityFeePerGas = await this.web3.eth.getMaxPriorityFeePerGas();
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  async getBalance(accountId) {
    const balance = await this.web3.eth.getBalance(accountId);
    const ONE_ETH = 1000000000000000000n;
    return Number((balance * 100n) / ONE_ETH) / 100;
  }

  async createMintaBtcSignedTx(near, sender, btcTxnHash) {
    // Get the nonce & gas price
    // console.log(`Getting nonce...`);
    const nonce = await this.web3.eth.getTransactionCount(sender);

    const { maxFeePerGas, maxPriorityFeePerGas } = await this.queryGasPrice();

    const payloadHeader = {
      btc_txn_hash: btcTxnHash,
      nonce: Number(nonce), // Convert BigInt to Number
      gas: Math.min(this.gasLimit, Number(maxFeePerGas)), // assuming gasLimit is a number
      max_fee_per_gas: Number(maxFeePerGas), // Convert BigInt to Number
      max_priority_fee_per_gas: Number(maxPriorityFeePerGas), // Convert BigInt to Number
    };

    try {
      const signed = await near.createMintaBtcSignedTx(payloadHeader);
      return new Uint8Array(signed);
    } catch (err) {
      const txnhash = err.context?.transactionHash;
      if (!txnhash) throw err;

      // if we have a transaction hash, we can wait until the transaction is confirmed
      const tx = await pRetry(
        async (count) => {
          console.log(
            `EVM createMintaBtcSignedTx - retries: ${count} | ${txnhash}`,
          );
          return near.provider.txStatus(txnhash, near.contract_id, "FINAL");
        },
        { retries: 10 },
      );
      if (!tx || !tx.status || !tx.status.SuccessValue) throw err;

      const value = Buffer.from(tx.status.SuccessValue, "base64").toString(
        "utf-8",
      );

      return new Uint8Array(JSON.parse(value));
    }
  }

  // This code can be used to actually relay the transaction to the Ethereum network
  async relayTransaction(signedTransaction) {
    const serializedTx = bytesToHex(signedTransaction);
    try {
      const relayed = await this.web3.eth.sendSignedTransaction(serializedTx);
      const txnHash = relayed.transactionHash;
      const status = relayed.status;

      return { txnHash, status };
    } catch (err) {
      console.log(err);
      console.log(
        `EVM relayTransaction error: ${err.message} | ${serializedTx}`,
      );
      throw err;
    }
  }

  // Function to get the current block number
  async getCurrentBlockNumber() {
    return await this.web3.eth.getBlockNumber();
  }

  // Get block number by timestamp using binary search
  async getBlockNumberByTimestamp(timestamp) {
    const latestBlock = await this.web3.eth.getBlock("latest");
    let startBlock = BigInt(0); // Ensure startBlock is a BigInt
    let endBlock = BigInt(latestBlock.number); // Ensure endBlock is a BigInt

    // Binary search to find the block closest to the timestamp
    while (startBlock <= endBlock) {
      const midBlock = (startBlock + endBlock) / 2n; // BigInt division
      const midBlockData = await this.web3.eth.getBlock(Number(midBlock)); // Convert midBlock to a regular number for web3 call

      if (BigInt(midBlockData.timestamp) < BigInt(timestamp)) {
        startBlock = midBlock + 1n;
      } else {
        endBlock = midBlock - 1n;
      }
    }

    const closestBlockData = await this.web3.eth.getBlock(Number(startBlock));
    return closestBlockData.number;
  }

  // Function to get block by number
  async getBlock(blockNumber) {
    return await this.web3.eth.getBlock(blockNumber);
  }

  // Function to get past events in batches
  // TO-DO: Create indexer so do not need to fetch all Burn Events for every run
  async getPastBurnEventsInBatches(startBlock, endBlock, batchSize) {
    console.log(`Fetching Events in batches... ${startBlock} -> ${endBlock}`);

    return this._scanEvents(
      EVENT_NAME.BURN_REDEEM,
      startBlock,
      endBlock,
      batchSize,
    );
  }

  async getPastMintEventsInBatches(startBlock, endBlock, batchSize) {
    console.log(`Fetching Events in batches... ${startBlock} -> ${endBlock}`);

    return this._scanEvents(
      EVENT_NAME.MINT_DEPOSIT,
      startBlock,
      endBlock,
      batchSize,
    );
  }

  async _scanEvents(
    eventName,
    startBlock,
    endBlock,
    batchSize,
    wallet,
    concurrency = 2,
  ) {
    const ranges = _.range(Number(startBlock), Number(endBlock), batchSize);

    const items = [];
    for (let i = 0; i < ranges.length; i += 1) {
      items.push({
        from: ranges[i],
        to: Math.min(ranges[i] + batchSize - 1, Number(endBlock)),
      });
    }

    const events = [];

    const chunk = _.chunk(items, concurrency);
    for (let i = 0; i < chunk.length; i++) {
      const found = await Promise.all(
        chunk[i].map(async (x) => {
          console.log(`---------- ${eventName}: ${x.from} -> ${x.to}`);
          const filters = { fromBlock: BigInt(x.from), toBlock: BigInt(x.to) };
          // wallet is indexed so we can filter by wallet
          if (wallet) filters.wallet = wallet;

          const items = await this.abtcContract.getPastEvents(
            eventName,
            filters,
          );

          return items;
        }),
      );
      events.push(..._.flatten(found));
    }

    return events.filter(
      (e) =>
        address.isValidEthereumAddress(
          e.returnValues && e.returnValues.wallet,
        ) ||
        address.isValidNearAddress(e.returnValues && e.returnValues.wallet),
    );
  }

  async deriveEthAddress(rootPublicKey, accountId, derivationPath) {
    //const rootPublicKey = 'secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3';

    const publicKey = await deriveChildPublicKey(
      await najPublicKeyStrToUncompressedHexPoint(rootPublicKey),
      accountId,
      derivationPath,
    );

    return await uncompressedHexPointToEvmAddress(publicKey);
  }

  async createAcceptOwnershipTx(near, sender) {
    const nonce = await this.web3.eth.getTransactionCount(sender);

    const { maxFeePerGas, maxPriorityFeePerGas } = await this.queryGasPrice();

    const params = {
      chain_id: this.chainID.toString(),
      nonce: Number(nonce), // Convert BigInt to Number
      gas: Math.min(this.gasLimit, Number(maxFeePerGas)), // assuming gasLimit is a number
      max_fee_per_gas: Number(maxFeePerGas), // Convert BigInt to Number
      max_priority_fee_per_gas: Number(maxPriorityFeePerGas), // Convert BigInt to Number
    };

    try {
      const signed = await near.createAcceptOwnershipTx(params);
      return new Uint8Array(signed);
    } catch (err) {
      const txnhash = err.context?.transactionHash;
      if (!txnhash) throw err;

      // if we have a transaction hash, we can wait until the transaction is confirmed
      const tx = await pRetry(
        async (count) => {
          console.log(
            `EVM createAcceptOwnershipTx - retries: ${count} | ${txnhash}`,
          );
          return near.provider.txStatus(txnhash, near.contract_id, "FINAL");
        },
        { retries: 10 },
      );
      if (!tx || !tx.status || !tx.status.SuccessValue) throw err;

      const value = Buffer.from(tx.status.SuccessValue, "base64").toString(
        "utf-8",
      );

      return new Uint8Array(JSON.parse(value));
    }
  }
}
module.exports = { Ethereum };
