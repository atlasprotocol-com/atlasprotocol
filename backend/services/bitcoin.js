const axios = require("axios");
const ethers = require("ethers");
const bitcoin = require("bitcoinjs-lib");
const ecc = require("@bitcoinerlab/secp256k1");
const { base_decode } = require("near-api-js/lib/utils/serialize");
const hash = require("hash.js");
const bs58check = require("bs58check");
const { send } = require("process");

const {
  derivep2wpkhChildPublicKey,
  najPublicKeyStrToUncompressedHexPoint,
  uncompressedHexPointToSegwitAddress,
} = require("../services/kdf");
const fetchWithRetry = require("../utils/fetchWithRetry");

// Initialize ECC library
bitcoin.initEccLib(ecc);

class Bitcoin {
  constructor(chain_rpc, network) {
    this.chain_rpc = chain_rpc;

    this.network =
      network === "testnet" || network === "signet"
        ? bitcoin.networks.testnet // This will select either 'testnet' or 'signet'
        : bitcoin.networks.bitcoin; // Default to mainnet if neither testnet nor signet is specified
  }

  async getBalance(address) {
    //console.log(`${this.chain_rpc}/address/${address}/utxo`);

    const response = await axios.get(
      `${this.chain_rpc}/address/${address}/utxo`,
    );
    const balance = response.data.reduce((acc, utxo) => acc + utxo.value, 0);

    return balance;
  }

  async getMockPayload(
    sender,
    receiver,
    satoshis,
    redemptionTxnHash,
    taxPercentage,
    treasury,
  ) {
    const utxos = await this.fetchUTXOs(sender);
    const feeRate = await this.fetchFeeRate();
    const psbt = new bitcoin.Psbt({ network: this.network });

    let totalInput = 0;
    let selectedUtxos = [];

    // Sort UTXOs by value in ascending order (smallest to largest)
    utxos.sort((a, b) => a.value - b.value);

    // Select UTXOs until the totalInput is enough to cover the satoshis + estimated fee + tax
    for (let i = 0; i < utxos.length; i++) {
      const utxo = utxos[i];
      selectedUtxos.push(utxo);
      totalInput += utxo.value;

      const estimatedSize = selectedUtxos.length * 148 + 34 + 100; // Approximate calculation
      const estimatedFee = Math.round(feeRate * estimatedSize);
      const taxAmount =
        taxPercentage > 0 ? Math.round(satoshis * taxPercentage) : 0;
      const requiredAmount = Number(satoshis) + estimatedFee + taxAmount;

      if (totalInput >= requiredAmount) {
        break;
      }
    }

    if (totalInput < Number(satoshis)) {
      throw new Error("Not enough funds to cover the transaction.");
    }

    await Promise.all(
      selectedUtxos.map(async (utxo) => {
        const transaction = await this.fetchTransaction(utxo.txid);
        let inputOptions;

        if (transaction.outs[utxo.vout].script.includes("0014")) {
          inputOptions = {
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
              script: transaction.outs[utxo.vout].script,
              value: utxo.value,
            },
          };
        } else {
          inputOptions = {
            hash: utxo.txid,
            index: utxo.vout,
            nonWitnessUtxo: Buffer.from(transaction.toHex(), "hex"),
          };
        }

        psbt.addInput(inputOptions);
      }),
    );

    let data = redemptionTxnHash;

    psbt.addOutput({
      script: bitcoin.script.compile([
        bitcoin.opcodes.OP_RETURN,
        Buffer.from(data),
      ]),
      value: 0,
    });

    const estimatedSize = selectedUtxos.length * 148 + 34 + 100; // Approximate calculation
    const estimatedFee = Math.round(feeRate * estimatedSize);
    const taxAmount =
      taxPercentage > 0 ? Math.round(satoshis * taxPercentage) : 0;

    let receiveAmount = Number(satoshis) - estimatedFee - taxAmount;
    let change = totalInput - Number(satoshis);

    if (receiveAmount > 0) {
      psbt.addOutput({
        address: receiver,
        value: receiveAmount,
      });
    }

    if (change > 0) {
      psbt.addOutput({
        address: sender,
        value: change,
      });
    }

    if (taxAmount > 0) {
      psbt.addOutput({
        address: treasury,
        value: taxAmount,
      });
    }

    return {
      psbt,
      utxos: selectedUtxos,
      estimatedFee,
      taxAmount,
      receiveAmount,
      change,
    };
  }

  // This code can be used to actually relay the transaction to the Ethereum network
  async relayTransaction(signedTransaction) {
    //console.log(this.chain_rpc);
    const response = await axios.post(
      `${this.chain_rpc}/tx`,
      signedTransaction,
    );
    return response.data;
  }

  /**
   * Converts a value from satoshis to bitcoins.
   *
   * @param {number} satoshi - The amount in satoshis to convert.
   * @returns {number} The equivalent amount in bitcoins.
   */
  static toBTC(satoshi) {
    return satoshi / 100000000;
  }

  /**
   * Converts a value from bitcoins to satoshis.
   *
   * @param {number} btc - The amount in bitcoins to convert.
   * @returns {number} The equivalent amount in satoshis.
   */
  static toSatoshi(btc) {
    return Number(btc * 100000000);
  }

  /**
   * Fetches the current fee rate from the Bitcoin network.
   * This method queries the RPC endpoint for fee estimates and returns the fee rate
   * expected for a transaction to be confirmed within a certain number of blocks.
   * The confirmation target is set to 6 blocks by default, which is commonly used
   * for a balance between confirmation time and cost.
   *
   * @returns {Promise<number>} A promise that resolves to the fee rate in satoshis per byte.
   * @throws {Error} Throws an error if the fee rate data for the specified confirmation target is missing.
   */
  async fetchFeeRate() {
    const response = await axios.get(`${this.chain_rpc}/fee-estimates`);
    const confirmationTarget = 6;
    return response.data[confirmationTarget];
  }

  /**
   * Fetches the Unspent Transaction Outputs (UTXOs) for a given Bitcoin address.
   *
   * @param {string} address - The Bitcoin address for which to fetch the UTXOs.
   * @returns {Promise<Array<{ txid: string; vout: number; value: number }>>} A promise that resolves to an array of UTXOs.
   * Each UTXO is represented as an object containing the transaction ID (`txid`), the output index within that transaction (`vout`),
   * and the value of the output in satoshis (`value`).
   */
  async fetchUTXOs(address) {
    const response = await axios.get(
      `${this.chain_rpc}/address/${address}/utxo`,
    );

    const utxos = response.data.map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      script: "",
    }));
    return utxos;
  }

  /**
   * Fetches a Bitcoin transaction by its ID and constructs a transaction object.
   * This function retrieves the transaction details from the blockchain using the RPC endpoint,
   * then parses the input and output data to construct a `bitcoin.Transaction` object.
   *
   * @param {string} transactionId - The ID of the transaction to fetch.
   * @returns {Promise<bitcoin.Transaction>} A promise that resolves to a `bitcoin.Transaction` object representing the fetched transaction.
   */
  async fetchTransaction(transactionId) {
    const { data } = await axios.get(`${this.chain_rpc}/tx/${transactionId}`);
    const tx = new bitcoin.Transaction();

    tx.version = data.version;
    tx.locktime = data.locktime;

    data.vin.forEach((vin) => {
      const txHash = Buffer.from(vin.txid, "hex").reverse();
      const vout = vin.vout;
      const sequence = vin.sequence;
      const scriptSig = vin.scriptsig
        ? Buffer.from(vin.scriptsig, "hex")
        : undefined;
      tx.addInput(txHash, vout, sequence, scriptSig);
    });

    data.vout.forEach((vout) => {
      const value = vout.value;
      const scriptPubKey = Buffer.from(vout.scriptpubkey, "hex");
      tx.addOutput(scriptPubKey, value);
    });

    data.vin.forEach((vin, index) => {
      if (vin.witness && vin.witness.length > 0) {
        const witness = vin.witness.map((w) => Buffer.from(w, "hex"));
        tx.setWitness(index, witness);
      }
    });

    return tx;
  }

  // Function which returns the txn's sender address
  async getBtcSenderAddress(txn) {
    const output = txn.vin[0].prevout.scriptpubkey_address;
    return output;
  }

  // Function which returns the txn's btc amount based on receiverAddress
  async getBtcReceivingAmount(txn, receiverAddress, treasuryAddress) {
    const output = txn.vout.find(
      (vout) => vout.scriptpubkey_address === receiverAddress,
    );

    const treasuryOutput = txn.vout.find(
      (vout) => vout.scriptpubkey_address === treasuryAddress,
    );
    
    const outputValue = output ? output.value : 0;
    const treasuryValue = treasuryOutput ? treasuryOutput.value : 0;

    return {
      btcAmount: outputValue + treasuryValue,
      feeAmount: treasuryValue
    };
  }

  // Function which returns the txn's receiving chain and receiving address based on OP_RETURN code
  async getChainAndAddressFromTxnHash(txn) {
    let chain = null;
    let address = null;
    let remarks = "";

    try {
      for (const vout of txn.vout) {
        const scriptPubKey = Buffer.from(vout.scriptpubkey, "hex");
        const chunks = bitcoin.script.decompile(scriptPubKey);
        if (chunks[0] === bitcoin.opcodes.OP_RETURN) {
          const embeddedData = chunks[1].toString("utf-8");
          [chain, address] = embeddedData.split(",");
          return { chain, address, remarks };
        }
      }

      throw new Error(`No embedded data found.`);
    } catch (error) {
      remarks = `Error from retrieveOpReturnFromTxnHash: ${error.message}`;
      //console.error(remarks);
      return { chain, address, remarks };
    }
  }

  // Function which returns the btc txn hash and timestamp based on OP_RETURN code
  // Function which returns the btc txn hash, timestamp, and confirmation status based on OP_RETURN code
  async getTxnHashAndTimestampFromOpReturnCode(
    btcMempool,
    address,
    redemptionTimestamp,
    opReturnCode,
  ) {
    let btcTxnHash = null;
    let timestamp = null;
    let hasConfirmed = false; // Add hasConfirmed status

    try {
      const filteredTxns = btcMempool.data.filter((txn) => {
        // Check if the transaction has any input matching the deposit address
        const hasMatchingInput = txn.vin.some(
          (vin) => vin.prevout.scriptpubkey_address === address,
        );

        // Check if the transaction's block time is greater than the redemption time
        const hasValidBlockTime =
          txn.status.block_time >= redemptionTimestamp ||
          !txn.status.block_time;

        // Check if the transaction has any output with the OP_RETURN data matching the provided opReturnCode
        const hasOpReturnData = txn.vout.some((vout) => {
          const opReturnData = this.decodeOpReturn(vout.scriptpubkey);
          return opReturnData === opReturnCode;
        });

        return hasMatchingInput && hasValidBlockTime && hasOpReturnData;
      });

      // Check if any records were found
      if (filteredTxns.length > 0) {
        const txn = filteredTxns[0];
        btcTxnHash = txn.txid;
        timestamp = txn.status.block_time;
        hasConfirmed = txn.status.confirmed; // Get the confirmation status
      }

      return { btcTxnHash, timestamp, hasConfirmed }; // Return the hasConfirmed status
    } catch (error) {
      throw new Error(
        `Error from getTxnHashAndTimestampFromOpReturnCode: ${error.message}`,
      );
    }
  }

  // Function to decode OP_RETURN data
  decodeOpReturn(scriptPubKey) {
    const script = bitcoin.script.decompile(Buffer.from(scriptPubKey, "hex"));
    if (script[0] === bitcoin.opcodes.OP_RETURN) {
      return script[1].toString("utf-8");
    }
    return null;
  }

  // Fetch BTC mempool data and getting unconfirmed transaction time for a particular txn
  async fetchUnconfirmedTransactionTime(txn) {
    try {
      console.log(`Getting unconfirmed txns...`);
      const axioConfig = {
        url: `${this.chain_rpc}/v1/transaction-times`,
        method: "get",
        params: { txId: [txn.txid] },
      };
      const response = await fetchWithRetry(axioConfig);
      const time = response.data[0];
      console.log(`Unconfirmed txn hash ${txn.txId} time: ${time}`);
      return time;
    } catch (error) {
      throw new Error(
        `Failed to fetch unconfirmed transactions: ${error.message}`,
      );
    }
  }

  // Fetch BTC mempool transactions based on address
  // To Confirm: https://mempool.space/signet/docs/api/rest#get-address-transactions
  //    Get transaction history for the specified address/scripthash, sorted with newest first.
  //    Returns up to 50 mempool transactions plus the first 25 confirmed transactions.
  //    You can request more confirmed transactions using an after_txid query parameter.
  async fetchTxnsByAddress(address) {
    //console.log(`${this.chain_rpc}/address/${address}/txs`);
    const axioConfig = {
      url: `${this.chain_rpc}/address/${address}/txs`,
      method: "get",
    };
    const response = await fetchWithRetry(axioConfig);

    return response;
  }

  // Fetch BTC mempool transaction based on transaction ID
  // Refer https://mempool.space/docs/api/rest#get-transaction
  async fetchTxnByTxnID(txnID) {
    const axioConfig = {
      url: `${this.chain_rpc}/tx/${txnID}`,
      method: "get",
    };
    const response = await fetchWithRetry(axioConfig);

    return response.data;
  }

  async deriveBTCAddress(rootPublicKey, accountId, derivationPath) {
    const publicKey = await derivep2wpkhChildPublicKey(
      await najPublicKeyStrToUncompressedHexPoint(rootPublicKey),
      accountId,
      derivationPath,
    );
    const address = await uncompressedHexPointToSegwitAddress(
      publicKey,
      this.network,
    );

    return { publicKey: Buffer.from(publicKey, "hex"), address };
  }

  async addUtxosToPsbt(psbt, selectedUtxos) {
    await Promise.all(
      selectedUtxos.map(async (utxo) => {
        // Fetch the transaction details using the txid
        const transaction = await this.fetchTransaction(utxo.txid);

        let inputOptions;

        // Check if the UTXO is a SegWit transaction
        if (transaction.outs[utxo.vout].script.includes("0014")) {
          // SegWit input (witnessUtxo)
          inputOptions = {
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
              script: transaction.outs[utxo.vout].script, // Script for the specific output
              value: utxo.value, // Value of the UTXO in satoshis
            },
          };
        } else {
          // Non-SegWit input (nonWitnessUtxo)
          inputOptions = {
            hash: utxo.txid,
            index: utxo.vout,
            nonWitnessUtxo: Buffer.from(transaction.toHex(), "hex"), // Full transaction hex for non-SegWit inputs
          };
        }

        // Add the input to the PSBT
        psbt.addInput(inputOptions);
      }),
    );
  }
}

module.exports = { Bitcoin };
