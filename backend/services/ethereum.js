const { Web3 } = require("web3");
const { bytesToHex } = require("@ethereumjs/util");
const { FeeMarketEIP1559Transaction } = require("@ethereumjs/tx");
const { Common } = require("@ethereumjs/common");
const { ethers } = require("ethers");
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
    // Handle both file path and direct ABI array
    this.contractABI = typeof abiPath === 'string' 
      ? JSON.parse(fs.readFileSync(path.resolve(__dirname, abiPath), "utf-8"))
      : abiPath;

    this.rpcUrl = rpcUrl;
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

  async satsToWei(sats, currencyPriceBtc) {
    const satsInBtc = sats / 100_000_000; // Convert sats to BTC
    const ethAmount = satsInBtc / currencyPriceBtc; // Convert BTC to ETH by dividing by BTC/ETH price ratio
    const weiAmount = BigInt(Math.ceil(ethAmount * 1e18)); // Convert ETH to wei using BigInt, using ceil to ensure enough funds
    return weiAmount;
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
    const polPrice = await cache.wrap(getPrice)("polygon", "usd");
    const polPriceBtc = polPrice / (ethPrice / ethPriceBtc);

    let mintingFeeWei;
    let mintingFeeUsd;
    if (this.chainID === 137 || this.chainID === 80002) {
      // Convert mintingFeeSat (in satoshis) to wei, adjusting for POL price
      mintingFeeWei = await this.satsToWei(mintingFeeSat, polPriceBtc);
      // Calculate minting fee in USD
      const mintingFeeEth = mintingFeeWei / BigInt(1e18);
      mintingFeeUsd = Number(mintingFeeEth) * polPrice;
    } else {
      // Convert mintingFeeSat (in satoshis) to wei, adjusting for ETH price
      console.log("mintingFeeSat: ", mintingFeeSat);
      console.log("ethPriceBtc: ", ethPriceBtc);
      mintingFeeWei = await this.satsToWei(mintingFeeSat, ethPriceBtc);
      console.log("mintingFeeWei: ", mintingFeeWei.toString());
      const mintingFeeEth = mintingFeeWei / BigInt(1e18);
      console.log("mintingFeeEth: ", mintingFeeEth.toString());
      console.log("ethPrice: ", ethPrice);
      mintingFeeUsd = Number(mintingFeeEth) * ethPrice;
    }

    console.log("chainID: ", this.chainID);
    console.log("mintingFeeUsd: ", mintingFeeUsd);
    console.log("mintingFeeWei: ", mintingFeeWei.toString());

    // Get current gas price
    const { baseFeePerGas: rawBaseFeePerGas } = await this.queryGasPrice();
    const baseFeePerGas = BigInt(rawBaseFeePerGas) * 120n / 100n; // 1.2 multiplier

    // Estimate gas for mintDeposit transaction
    const gasLimit = BigInt(Math.ceil(Number(await this.abtcContract.methods
      .mintDeposit(receiver, amount, btcTxnHash)
      .estimateGas({ from: sender })) * 1.2));

    // Calculate required gas price to match minting fee
    const requiredGasPrice = mintingFeeWei / gasLimit;
    console.log("requiredGasPrice: ", requiredGasPrice.toString());
    

    return {
      baseFeePerGas: Number(baseFeePerGas),
      gasLimit: Number(gasLimit),
      gasPrice: Number(requiredGasPrice),
      maxPriority: Number(baseFeePerGas),
      mintingFeeUsd: Math.ceil(mintingFeeUsd),
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
    const polPrice = await cache.wrap(getPrice)("polygon", "usd");
    const polPriceBtc = polPrice / (ethPrice / ethPriceBtc);

    let mintingFeeWei;
    let mintingFeeUsd;
    if (this.chainID === 137 || this.chainID === 80002) {
      // Convert mintingFeeSat (in satoshis) to wei, adjusting for POL price
      mintingFeeWei = await this.satsToWei(mintingFeeSat, polPriceBtc);
      // Calculate minting fee in USD
      const mintingFeeEth = mintingFeeWei / BigInt(1e18);
      mintingFeeUsd = Number(mintingFeeEth) * polPrice;
    } else {
      // Convert mintingFeeSat (in satoshis) to wei, adjusting for ETH price
      mintingFeeWei = await this.satsToWei(mintingFeeSat, ethPriceBtc);
      const mintingFeeEth = mintingFeeWei / BigInt(1e18);
      mintingFeeUsd = Number(mintingFeeEth) * ethPrice;
    }

    console.log("chainID: ", this.chainID);
    console.log("mintingFeeUsd: ", mintingFeeUsd);
    console.log("mintingFeeWei: ", mintingFeeWei.toString());

    // Get current gas price
    const { baseFeePerGas: rawBaseFeePerGas } = await this.queryGasPrice();
    const baseFeePerGas = BigInt(rawBaseFeePerGas) * 110n / 100n; // 1.1 multiplier

    // Estimate gas for mintDeposit transaction
    const gasLimit = BigInt(Math.ceil(Number(await this.abtcContract.methods
      .mintBridge(
        receiver,
        amount,
        originChainId,
        originChainAddress,
        originTxnHash,
      )
      .estimateGas({ from: sender })) * 1.1));

    // Calculate required gas price to match minting fee
    const requiredGasPrice = mintingFeeWei / gasLimit;
    console.log("requiredGasPrice: ", requiredGasPrice.toString());
    

    return {
      baseFeePerGas: Number(baseFeePerGas),
      gasLimit: Number(gasLimit),
      gasPrice: Number(requiredGasPrice),
      maxPriority: Number(baseFeePerGas),
      mintingFeeUsd: Math.ceil(mintingFeeUsd),
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
    console.log("maxPriority:", maxPriority);

    if (gasPrice < baseFeePerGas) {
      throw new Error("Gas price is less than base fee per gas");
    }

    const payloadHeader = {
      btc_txn_hash: btcTxnHash,
      nonce: Number(nonce), // Convert BigInt to Number
      gas: gasLimit, // assuming gasLimit is a number
      max_fee_per_gas: baseFeePerGas, // Convert BigInt to Number
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
        { retries: 10, factor: 5 },
      );
      if (!tx || !tx.status || !tx.status.SuccessValue) {
        const failure = JSON.stringify(tx && tx.status);
        console.log(
          `Tx Failure ###########################################: ${failure}`,
        );
        throw err;
      }

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

    if (gasPrice < baseFeePerGas) {
      throw new Error("Gas price is less than base fee per gas");
    }

    const payloadHeader = {
      txn_hash: txnHash,
      nonce: Number(nonce), // Convert BigInt to Number
      gas: gasLimit, // assuming gasLimit is a number
      max_fee_per_gas: baseFeePerGas, // Convert BigInt to Number
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
      if (!tx || !tx.status || !tx.status.SuccessValue) {
        const failure = JSON.stringify(tx && tx.status);
        console.log(
          `Tx Failure ###########################################: ${failure}`,
        );
        throw err;
      }

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
  async relayTransaction(signedTransaction, timeoutMs = 120000) { // Default 2 minute timeout
    try {
      console.log("[relayTransaction] signedTransaction: ", signedTransaction);
      const serializedTx = bytesToHex(signedTransaction);
      console.log("[relayTransaction] serializedTx: ", serializedTx);
      
      // Verify serializedTx format - should be a long hex string starting with 0x02f9
      if (!serializedTx.startsWith('0x02f9') || !/^0x[0-9a-fA-F]+$/.test(serializedTx)) {
        throw new Error('Invalid transaction format - must be EIP-1559 transaction starting with 0x02f9');
      }

      // Create a new ethers provider
      const provider = new ethers.JsonRpcProvider(this.rpcUrl);
      
      console.log("[relayTransaction] Attempting to send transaction...");
      const tx = await provider.broadcastTransaction(serializedTx);
      console.log("[relayTransaction] Transaction sent successfully:", tx.hash);
      
      // Wait for transaction to be mined with timeout
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Transaction ${tx.hash} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
      console.log("[relayTransaction] Transaction mined:", receipt);

      return { 
        txnHash: receipt.hash, 
        status: receipt.status === 1 ? true : false 
      };
    } catch (err) {
      console.error("[relayTransaction] Error:", {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      throw err;
    }
  }

  // Function to get the current block number
  async getCurrentBlockNumber() {
    return Number(await this.web3.eth.getBlockNumber());
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

  // // Function to get past events in batches
  // // TO-DO: Create indexer so do not need to fetch all Burn Events for every run
  // async getPastBurnEventsInBatches(startBlock, endBlock, batchSize) {
  //   console.log(`Fetching Events in batches... ${startBlock} -> ${endBlock}`);

  //   return this._scanEvents(
  //     EVENT_NAME.BURN_REDEEM,
  //     startBlock,
  //     endBlock,
  //     batchSize,
  //   );
  // }

  // // Function to get past events in batches
  // // TO-DO: Create indexer so do not need to fetch all Burn Events for every run
  // async getPastBurnBridgingEventsInBatches(
  //   startBlock,
  //   endBlock,
  //   batchSize,
  //   wallet,
  // ) {
  //   console.log(
  //     `Fetching Events in batches... ${startBlock} -> ${endBlock} | ${batchSize}`,
  //   );

  //   return this._scanEvents(
  //     EVENT_NAME.BURN_BRIDGE,
  //     startBlock,
  //     endBlock,
  //     batchSize,
  //     wallet,
  //   );
  // }

  async getPastMintEventsInBatches(startBlock, endBlock, batchSize) {
    console.log(`Fetching Events in batches... ${startBlock} -> ${endBlock}`);

    return this._scanEvents(
      EVENT_NAME.MINT_DEPOSIT,
      startBlock,
      endBlock,
      batchSize,
    );
  }

  // async getPastMintBridgeEventsInBatches(startBlock, endBlock, batchSize) {
  //   console.log(`Fetching Events in batches... ${startBlock} -> ${endBlock}`);

  //   return this._scanEvents(
  //     EVENT_NAME.MINT_BRIDGE,
  //     startBlock,
  //     endBlock,
  //     batchSize,
  //   );
  // }

  // New combined function that can handle all event types
  async getPastEventsInBatches(startBlock, endBlock, batchSize, wallet) {
    console.log(`Fetching all events in batches... ${startBlock} -> ${endBlock}`);

    const eventTypes = [
      EVENT_NAME.BURN_REDEEM,
      EVENT_NAME.BURN_BRIDGE,
      EVENT_NAME.MINT_DEPOSIT, 
      EVENT_NAME.MINT_BRIDGE
    ];

    const allEvents = await this._scanEvents(
      eventTypes,
      startBlock,
      endBlock, 
      batchSize,
      wallet
    );

    return allEvents;
  }

  async _scanEvents(
    eventTypes,
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
          try {
            console.log(`---------- Scanning blocks: ${x.from} -> ${x.to}`);
            const filters = { fromBlock: BigInt(x.from), toBlock: BigInt(x.to) };

            if (wallet) filters.wallet = wallet;

            let allEvents = [];
            const eventPromises = eventTypes.map(eventName => 
              this.abtcContract.getPastEvents(eventName, filters)
                .catch(err => {
                  console.error(`Error fetching events for ${eventName}:`, err);
                  return [];
                })
            );
            
            const results = await Promise.all(eventPromises);
            allEvents = results.flat();
            return allEvents;
          } catch (err) {
            console.error(`Error scanning blocks ${x.from} -> ${x.to}:`, err);
            return [];
          }
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
    const gasLimit = Math.ceil(Number(await this.abtcContract.methods
      .acceptOwnership()
      .estimateGas({ from: sender })) * 1.1);

    const params = {
      chain_id: this.chainID.toString(),
      nonce: Number(nonce), // Convert BigInt to Number
      gas: Number(gasLimit), // assuming gasLimit is a number
      max_fee_per_gas: Math.max(Number(baseFeePerGas * BigInt(11) / BigInt(10)), Number(maxPriorityFeePerGas)), // Convert BigInt to Number
      max_priority_fee_per_gas: Math.max(Number(maxPriorityFeePerGas * BigInt(11) / BigInt(10)), Number(maxPriorityFeePerGas)), // Convert BigInt to Number
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
      if (!tx || !tx.status || !tx.status.SuccessValue) {
        const failure = JSON.stringify(tx && tx.status);
        console.log(
          `Tx Failure ###########################################: ${failure}`,
        );
        throw err;
      }

      const value = Buffer.from(tx.status.SuccessValue, "base64").toString(
        "utf-8",
      );

      return new Uint8Array(JSON.parse(value));
    }
  }

  async fetchEventByTxnHashAndEventName(txnHash, eventName) {
    
    const receipt = await this.web3.eth.getTransactionReceipt(txnHash);
    if (!receipt) return null;

    const events = await this.abtcContract.getPastEvents(eventName, { fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber });

    return events[0];
  }

  /**
   * Get all events of a specific type using ethers.js
   * @param {string} eventName - Name of the event to fetch
   * @param {number} [fromBlock=0] - Starting block number, defaults to 0
   * @param {number} [toBlock='latest'] - Ending block number, defaults to latest block
   * @returns {Promise<Array>} Array of events with transaction hashes
   */
  async getEventsByType(eventName, fromBlock = 0, toBlock = 'latest') {
    try {
      console.log(`[getEventsByType] Fetching ${eventName} events from block ${fromBlock} to ${toBlock}`);
      
      // Create ethers contract instance
      const provider = new ethers.JsonRpcProvider(this.rpcUrl);
      const contract = new ethers.Contract(this.aBTCAddress, this.contractABI, provider);

      // Get events
      const events = await contract.queryFilter(eventName, fromBlock, toBlock);
      
      // Format events to include transaction hash
      const formattedEvents = events.map(event => ({
        eventName: eventName,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        args: event.args,
        timestamp: event.timestamp,
        logIndex: event.logIndex
      }));

      console.log(`[getEventsByType] Found ${formattedEvents.length} ${eventName} events`);
      return formattedEvents;
    } catch (error) {
      console.error(`[getEventsByType] Error fetching ${eventName} events:`, {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
  }
}
module.exports = { Ethereum };
