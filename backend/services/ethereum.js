const { Web3 } = require("web3");
const { bytesToHex } = require("@ethereumjs/util");
const { FeeMarketEIP1559Transaction } = require("@ethereumjs/tx");
const { Common } = require("@ethereumjs/common");
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const pRetry = require("p-retry");

const { getPrice } = require("../coin");
const { MemoryCache } = require("../cache");
const { getConstants } = require("../constants");

const address = require("./address");
const {
  deriveChildPublicKey,
  najPublicKeyStrToUncompressedHexPoint,
  uncompressedHexPointToEvmAddress,
} = require("./kdf");

const { EVENT_NAME } = getConstants(); // Access constants dynamically
const cache = new MemoryCache();

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
    const baseFeePerGas = await this.web3.eth.getGasPrice();
    const maxPriorityFeePerGas = await this.web3.eth.getMaxPriorityFeePerGas();
    return { baseFeePerGas, maxPriorityFeePerGas };
  }

  async estimateMintingGasLimit(sender, receiver, amount, btcTxnHash) {
    // Estimate gas for mintDeposit transaction using sender address
    const gasLimit = await this.abtcContract.methods
      .mintDeposit(receiver, amount, btcTxnHash)
      .estimateGas({ from: sender });

    return Number(gasLimit);
  }

  async satsToWei(sats, ethPriceBtc) {
    const satsInBtc = sats / 100_000_000; // Convert sats to BTC
    const ethAmount = satsInBtc / ethPriceBtc; // Convert BTC to ETH by dividing by BTC/ETH price ratio
    const weiAmount = BigInt(Math.floor(ethAmount * 1e18)); // Convert ETH to wei using BigInt
    return weiAmount; // Remove decimals before converting to BigInt
  }

  async calculateEvmGasFeeFromMintingFee(
    sender,
    receiver,
    amount,
    btcTxnHash,
    mintingFeeSat,
  ) {
    const ethPriceBtc = await cache.wrap(getPrice)("ethereum", "btc");
    const ethPrice = await cache.wrap(getPrice)("ethereum", "usd");

    // Convert mintingFeeSat (in satoshis) to wei
    const mintingFeeWei = await this.satsToWei(mintingFeeSat, ethPriceBtc);

    // Get current gas price
    const { baseFeePerGas, maxPriorityFeePerGas } = await this.queryGasPrice();

    // Estimate gas for mintDeposit transaction
    const gasLimit = await this.abtcContract.methods
      .mintDeposit(receiver, amount, btcTxnHash)
      .estimateGas({ from: sender });

    // Calculate required gas price to match minting fee
    // mintingFeeWei = gasLimit * gasPrice
    // Therefore: gasPrice = mintingFeeWei / gasLimit
    const requiredGasPrice = mintingFeeWei / BigInt(gasLimit);

    console.log(BigInt(gasLimit) * requiredGasPrice);
    // Calculate minting fee in USD
    const mintingFeeEth = Number(BigInt(gasLimit) * requiredGasPrice) / 1e18;

    console.log(mintingFeeEth);
    const mintingFeeUsd = mintingFeeEth * ethPrice;

    return {
      baseFeePerGas: Number(baseFeePerGas),
      gasLimit: Number(gasLimit),
      gasPrice: Number(requiredGasPrice),
      maxPriority: Number(requiredGasPrice) - Number(baseFeePerGas),
      mintingFeeUsd: mintingFeeUsd,
    };
  }

  async calculateEvmGasFeeFromMintingBridgeFee(
    sender,
    receiver,
    amount,
    originChainId,
    originChainAddress,
    originTxnHash,
    mintingFeeSat,
  ) {
    const ethPriceBtc = await cache.wrap(getPrice)("ethereum", "btc");
    const ethPrice = await cache.wrap(getPrice)("ethereum", "usd");

    // Convert mintingFeeSat (in satoshis) to wei
    const mintingFeeWei = await this.satsToWei(mintingFeeSat, ethPriceBtc);

    // Get current gas price
    const { baseFeePerGas, maxPriorityFeePerGas } = await this.queryGasPrice();

    // Estimate gas for mintDeposit transaction
    const gasLimit = await this.abtcContract.methods
      .mintBridge(
        receiver,
        amount,
        originChainId,
        originChainAddress,
        originTxnHash,
      )
      .estimateGas({ from: sender });

    // Calculate required gas price to match minting fee
    // mintingFeeWei = gasLimit * gasPrice
    // Therefore: gasPrice = mintingFeeWei / gasLimit
    const requiredGasPrice = mintingFeeWei / BigInt(gasLimit);

    // Calculate minting fee in USD
    const mintingFeeEth = Number(BigInt(gasLimit) * requiredGasPrice) / 1e18;

    const mintingFeeUsd = mintingFeeEth * ethPrice;

    return {
      baseFeePerGas: Number(baseFeePerGas),
      gasLimit: Number(gasLimit),
      gasPrice: Number(requiredGasPrice),
      maxPriority: Number(requiredGasPrice) - Number(baseFeePerGas),
      mintingFeeUsd: mintingFeeUsd,
    };
  }

  async getBalance(accountId) {
    const balance = await this.web3.eth.getBalance(accountId);
    const ONE_ETH = 1000000000000000000n;
    return Number((balance * 100n) / ONE_ETH) / 100;
  }

  async createPayload(sender, receiver, amount) {
    const common = new Common({ chain: this.chainID });

    // Get the nonce & gas price
    const nonce = await this.web3.eth.getTransactionCount(sender);
    const { baseFeePerGas: maxFeePerGas, maxPriorityFeePerGas } =
      await this.queryGasPrice();

    // Construct transaction
    const transactionData = {
      nonce,
      gasLimit: 21000,
      maxFeePerGas,
      maxPriorityFeePerGas,
      to: receiver,
      value: BigInt(this.web3.utils.toWei(amount, "ether")),
      chain: this.chainID,
    };

    console.log(transactionData);

    const transaction = FeeMarketEIP1559Transaction.fromTxData(
      transactionData,
      { common },
    );
    const payload = transaction.getHashedMessageToSign();

    return { transaction, payload };
  }

  async createMintaBtcSignedTx(
    near,
    sender,
    receiver,
    amount,
    btcTxnHash,
    mintingFeeSat,
  ) {
    // Log input parameters
    console.log("sender:", sender);
    console.log("receiver:", receiver);
    console.log("amount:", amount);
    console.log("btcTxnHash:", btcTxnHash);
    console.log("mintingFeeSat:", mintingFeeSat);

    // Get the nonce & gas price
    const nonce = await this.web3.eth.getTransactionCount(sender);

    const { baseFeePerGas, gasLimit, gasPrice, maxPriority, mintingFeeUsd } =
      await this.calculateEvmGasFeeFromMintingFee(
        sender,
        receiver,
        amount,
        btcTxnHash,
        mintingFeeSat,
      );

    console.log("baseFeePerGas:", baseFeePerGas);
    console.log("gasLimit:", gasLimit);
    console.log("gasPrice:", gasPrice);
    console.log("mintingFeeUsd:", mintingFeeUsd);

    if (gasPrice < baseFeePerGas) {
      throw new Error("Gas price is less than base fee per gas");
    }

    const payloadHeader = {
      btc_txn_hash: btcTxnHash,
      nonce: Number(nonce), // Convert BigInt to Number
      gas: gasLimit, // assuming gasLimit is a number
      max_fee_per_gas: gasPrice, // Convert BigInt to Number
      max_priority_fee_per_gas: maxPriority, // Convert BigInt to Number
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

  async createMintBridgeABtcSignedTx(
    near,
    txnHash,
    sender,
    receiver,
    amount,
    originChainId,
    originChainAddress,
    originTxnHash,
    mintingFeeSat,
  ) {
    // Get the nonce & gas price
    // console.log(`Getting nonce...`);
    const nonce = await this.web3.eth.getTransactionCount(sender);

    const { baseFeePerGas, gasLimit, gasPrice, maxPriority, mintingFeeUsd } =
      await this.calculateEvmGasFeeFromMintingBridgeFee(
        sender,
        receiver,
        amount,
        originChainId,
        originChainAddress,
        originTxnHash,
        mintingFeeSat,
      );

    console.log("baseFeePerGas:", baseFeePerGas);
    console.log("gasLimit:", gasLimit);
    console.log("gasPrice:", gasPrice);
    console.log("mintingFeeUsd:", mintingFeeUsd);

    const payloadHeader = {
      txn_hash: txnHash,
      nonce: Number(nonce), // Convert BigInt to Number
      gas: gasLimit, // assuming gasLimit is a number
      max_fee_per_gas: Math.max(gasPrice, baseFeePerGas), // Convert BigInt to Number
      max_priority_fee_per_gas: maxPriority, // Convert BigInt to Number
    };

    try {
      const signed = await near.createMintBridgeABtcSignedTx(payloadHeader);
      return new Uint8Array(signed);
    } catch (err) {
      const txnhash = err.context?.transactionHash;
      if (!txnhash) throw err;

      // if we have a transaction hash, we can wait until the transaction is confirmed
      const tx = await pRetry(
        async (count) => {
          console.log(
            `EVM createMintBridgeABtcSignedTx - retries: ${count} | ${txnhash}`,
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
  // This is a sample function for send eth transaction, Arbitrum gasLimit set to 5 million
  async createSendEthPayload(sender, receiver, amount) {
    const common = new Common({ chain: this.chainID });

    // Get the nonce & gas price
    const nonce = await this.web3.eth.getTransactionCount(sender);
    console.log(`Nonce: ${nonce}`);

    const { baseFeePerGas: maxFeePerGas, maxPriorityFeePerGas } =
      await this.queryGasPrice();
    console.log(`maxFeePerGas: ${maxFeePerGas}`);
    console.log(`maxPriorityFeePerGas: ${maxPriorityFeePerGas}`);

    // Construct transaction
    const transactionData = {
      nonce,
      gasLimit: 5000000, // 5 million
      maxFeePerGas,
      maxPriorityFeePerGas,
      to: receiver,
      value: BigInt(this.web3.utils.toWei(amount, "ether")),
      chain: this.chainID,
    };

    console.log(transactionData);

    const transaction = FeeMarketEIP1559Transaction.fromTxData(
      transactionData,
      { common },
    );
    const payload = transaction.getHashedMessageToSign();

    return { transaction, payload };
  }

  // This code can be used to actually relay the transaction to the Ethereum network
  async relayTransaction(signedTransaction) {
    const serializedTx = bytesToHex(signedTransaction);
    try {
      const relayed = await this.web3.eth.sendSignedTransaction(serializedTx);
      const txnHash = relayed.transactionHash;
      const receipt = relayed.receipt;
      const status = relayed.status;
      console.log("receipt: " + receipt);
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

  // Function to get past events in batches
  // TO-DO: Create indexer so do not need to fetch all Burn Events for every run
  async getPastBurnBridgingEventsInBatches(
    startBlock,
    endBlock,
    batchSize,
    wallet,
  ) {
    console.log(
      `Fetching Events in batches... ${startBlock} -> ${endBlock} | ${batchSize}`,
    );

    return this._scanEvents(
      EVENT_NAME.BURN_BRIDGE,
      startBlock,
      endBlock,
      batchSize,
      wallet,
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

  async getPastMintBridgeEventsInBatches(startBlock, endBlock, batchSize) {
    console.log(`Fetching Events in batches... ${startBlock} -> ${endBlock}`);

    return this._scanEvents(
      EVENT_NAME.MINT_BRIDGE,
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
    concurrency = 1,
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

  // Request Signature to MPC
  async requestSignatureToMPC(near, path, ethPayload, transaction, sender) {
    // Ask the MPC to sign the payload
    //const payload = Array.from(ethPayload.reverse());
    const payload = Array.from(ethPayload);
    const signArgs = {
      payload: payload,
      path: path,
      key_version: 0,
    };

    //await near.reInitialiseConnection();

    const result = await near.nearMPCContract.sign({
      args: { request: signArgs },
      gas: "300000000000000",
      amount: 1,
    });

    /*
    const result = await near.account.signAndSendTransaction({
      receiverId: near.mpcContractId,
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName: 'sign',
            args,
            gas,
            deposit,
          },
        },
      ],
    });
    */

    const r = Buffer.from(`${result.big_r.affine_point.substring(2)}`, "hex");
    const s = Buffer.from(`${result.s.scalar}`, "hex");

    // const signature = {
    //   r: `0x${result.big_r.affine_point.substring(2)}`,
    //   s: `0x${result.s.scalar}`,
    //   yParity: result.recovery_id,
    // };

    //console.log(signature)

    const candidates = [0n, 1n].map((v) => transaction.addSignature(v, r, s));
    const signature = candidates.find((c) => {
      const senderAddress = c.getSenderAddress().toString().toLowerCase();
      return senderAddress === sender.toLowerCase();
    });

    if (signature.getValidationErrors().length > 0)
      throw new Error("Transaction validation errors");
    if (!signature.verifySignature()) throw new Error("Signature is not valid");

    return signature;
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

    const { baseFeePerGas, maxPriorityFeePerGas } = await this.queryGasPrice();

    const params = {
      chain_id: this.chainID.toString(),
      nonce: Number(nonce), // Convert BigInt to Number
      gas: Math.min(this.gasLimit, Number(baseFeePerGas)), // assuming gasLimit is a number
      max_fee_per_gas: Number(baseFeePerGas), // Convert BigInt to Number
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
