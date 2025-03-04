const {
  connect,
  keyStores,
  KeyPair,
  Contract,
  providers,
} = require("near-api-js");
const pRetry = require("p-retry");
const address = require("./address");

const { InMemoryKeyStore } = keyStores;

class Near {
  static TRANSACTION_ROOT = "11111111111111111111111111111111";

  constructor(
    chain_rpc,
    atlas_account_id,
    contract_id,
    pk,
    network_id,
    gas,
    mpcContractId,
    aBTCAddress,
  ) {
    this.chain_rpc = chain_rpc;
    this.atlas_account_id = atlas_account_id;
    this.contract_id = contract_id;
    this.pk = pk;
    this.network_id = network_id;
    this.keyStore = new InMemoryKeyStore();
    this.provider = new providers.JsonRpcProvider({ url: this.chain_rpc }); // Initialize provider here
    this.nearContract = null;
    this.gas = gas;
    this.mpcContractId = mpcContractId;
    this.aBTCAddress = aBTCAddress;
  }

  async init() {
    try {
      const keyPair = KeyPair.fromString(this.pk);
      await this.keyStore.setKey(
        this.network_id,
        this.atlas_account_id,
        keyPair,
      );

      // Setup connection to NEAR
      const nearConnection = await connect({
        networkId: this.network_id,
        keyStore: this.keyStore,
        nodeUrl: this.chain_rpc,
        // walletUrl: `https://wallet.${this.network_id}.near.org`,
        // helperUrl: `https://helper.${this.network_id}.near.org`,
        // explorerUrl: `https://explorer.${this.network_id}.near.org`,
      });

      this.account = await nearConnection.account(this.atlas_account_id);

      this.nearContract = new Contract(this.account, this.contract_id, {
        viewMethods: [
          "get_deposit_by_btc_txn_hash",
          "get_all_deposits",
          "get_redemption_by_txn_hash",
          "get_all_redemptions",
          "get_all_global_params",
          "get_all_chain_configs",
          "get_all_constants",
          "get_chain_config_by_chain_id",
          "get_first_valid_deposit_chain_config",
          "get_first_valid_redemption",
        ],
        changeMethods: [
          "insert_deposit_btc",
          "update_deposit_remarks",
          "insert_redemption_abtc",
          "update_redemption_remarks",
          "create_mint_abtc_signed_tx",
          "update_deposit_minted_txn_hash",
          "update_deposit_minted",
          "update_deposit_btc_deposited",
          "create_redeem_abtc_signed_payload",
          "create_redeem_abtc_transaction",
          "update_redemption_start",
          "update_redemption_pending_btc_mempool",
          "update_redemption_redeemed",
          "update_redemption_custody_txn_id",
          "create_abtc_accept_ownership_tx",
          "withdraw_fail_deposit_by_btc_tx_hash",
          "update_deposit_custody_txn_id",
          "rollback_deposit_status_by_btc_txn_hash",
        ],
      });

      this.nearMPCContract = new Contract(this.account, this.mpcContractId, {
        viewMethods: ["public_key"],
        changeMethods: ["sign"],
      });
    } catch (error) {
      console.error("Failed to initialize NEAR contract:", error);
      throw error;
    }
  }

  // General function to make NEAR RPC view calls
  async makeNearRpcViewCall(methodName, args) {
    if (!this.nearContract) {
      throw new Error("NEAR contract is not initialized. Call init() first.");
    }
    try {
      const result = await this.nearContract[methodName](args);
      return result;
    } catch (error) {
      throw new Error(`Failed to call method ${methodName}: ${error.message}`);
    }
  }

  // General function to make NEAR RPC change calls using this.nearContract
  async makeNearRpcChangeCall(methodName, args) {
    if (!this.nearContract) {
      throw new Error("NEAR contract is not initialized. Call init() first.");
    }

    // MUST return original error to retrieve error context
    return this.nearContract[methodName]({
      args,
      gas: this.gas,
      amount: this.amount,
    });
  }

  // Function to get deposit by BTC sender address from NEAR contract
  async getDepositByBtcAddress(btcWalletAddress) {
    return this.makeNearRpcViewCall("get_deposits_by_btc_sender_address", {
      btc_sender_address: btcWalletAddress,
    });
  }

  // Function to get redemption by BTC sender address from NEAR contract
  async getRedemptionsByBtcAddress(btcWalletAddress) {
    return this.makeNearRpcViewCall(
      "get_redemptions_by_btc_receiving_address",
      {
        btc_receiving_address: btcWalletAddress,
      },
    );
  }

  // Function to get all deposits from NEAR contract
  async getAllDeposits() {
    return this.makeNearRpcViewCall("get_all_deposits", {});
  }

  // Function to get all deposits from NEAR contract
  async getGlobalParams() {
    return this.makeNearRpcViewCall("get_all_global_params", {});
  }

  // Function to get all redemptions from NEAR contract
  async getAllRedemptions() {
    return this.makeNearRpcViewCall("get_all_redemptions", {});
  }

  async getRedemptionByTxnHash(transactionHash) {
    return this.makeNearRpcViewCall("get_redemption_by_txn_hash", {
      txn_hash: transactionHash,
    });
  }

  async getDepositByBtcTxnHash(transactionHash) {
    return this.makeNearRpcViewCall("get_deposit_by_btc_txn_hash", {
      btc_txn_hash: transactionHash,
    });
  }

  async getChainConfigs() {
    return this.makeNearRpcViewCall("get_all_chain_configs", {});
  }

  async getConstants() {
    return this.makeNearRpcViewCall("get_all_constants", {});
  }

  async getChainConfig(chainId) {
    return this.makeNearRpcViewCall("get_chain_config_by_chain_id", {
      chain_id: chainId,
    });
  }

  async getFirstValidDepositChainConfig() {
    return this.makeNearRpcViewCall("get_first_valid_deposit_chain_config", {});
  }

  async getFirstValidRedemption() {
    return this.makeNearRpcViewCall("get_first_valid_redemption", {});
  }

  async updateDepositBtcDeposited(btcTxnHash, timestamp) {
    return this.makeNearRpcChangeCall("update_deposit_btc_deposited", {
      btc_txn_hash: btcTxnHash,
      timestamp: timestamp,
    });
  }

  async updateDepositRemarks(btcTxnHash, remarks) {
    return this.makeNearRpcChangeCall("update_deposit_remarks", {
      btc_txn_hash: btcTxnHash,
      remarks: remarks,
    });
  }

  async updateDepositMintedTxnHash(btcTxnHash, mintedTxnHash) {
    return this.makeNearRpcChangeCall("update_deposit_minted_txn_hash", {
      btc_txn_hash: btcTxnHash,
      minted_txn_hash: mintedTxnHash,
    });
  }
  async updateDepositMinted(btcTxnHash, mintedTxnHash) {
    return this.makeNearRpcChangeCall("update_deposit_minted", {
      btc_txn_hash: btcTxnHash,
      minted_txn_hash: mintedTxnHash,
    });
  }

  async insertDepositBtc(
    btcTxnHash,
    btcSenderAddress,
    receivingChainID,
    receivingAddress,
    btcAmount,
    feeAmount,
    mintedTxnHash,
    timestamp,
    remarks,
    date_created,
  ) {
    return this.makeNearRpcChangeCall("insert_deposit_btc", {
      btc_txn_hash: btcTxnHash,
      btc_sender_address: btcSenderAddress,
      receiving_chain_id: receivingChainID,
      receiving_address: receivingAddress,
      btc_amount: btcAmount,
      fee_amount: feeAmount,
      minted_txn_hash: mintedTxnHash,
      timestamp: timestamp,
      remarks: remarks,
      date_created: date_created,
    });
  }

  async insertRedemptionAbtc(
    transactionHash,
    aBtcRedemptionAddress,
    aBtcRedemptionChainId,
    btcAddress,
    amount,
    timestamp,
    date_created,
    custody_txn_id,
  ) {
    return this.makeNearRpcChangeCall("insert_redemption_abtc", {
      txn_hash: transactionHash,
      abtc_redemption_address: aBtcRedemptionAddress,
      abtc_redemption_chain_id: aBtcRedemptionChainId,
      btc_receiving_address: btcAddress,
      abtc_amount: amount,
      timestamp: timestamp,
      date_created: date_created,
      custody_txn_id: custody_txn_id,
    });
  }

  async updateRedemptionStart(txnHash) {
    return this.makeNearRpcChangeCall("update_redemption_start", {
      txn_hash: txnHash,
    });
  }

  async updateRedemptionPendingBtcMempool(redemptionTxnHash, btcTxnHash) {
    console.log(redemptionTxnHash);
    console.log(btcTxnHash);
    return this.makeNearRpcChangeCall("update_redemption_pending_btc_mempool", {
      txn_hash: redemptionTxnHash,
      btc_txn_hash: btcTxnHash,
    });
  }

  async updateRedemptionRedeemed(redemptionTxnHash, btcTxnHash, timestamp) {
    return this.makeNearRpcChangeCall("update_redemption_redeemed", {
      txn_hash: redemptionTxnHash,
      btc_txn_hash: btcTxnHash,
      timestamp: timestamp,
    });
  }

  async updateRedemptionCustodyTxnId(txnHash, custody_txn_id) {
    console.log(txnHash);
    console.log(custody_txn_id);
    return this.makeNearRpcChangeCall("update_redemption_custody_txn_id", {
      txn_hash: txnHash,
      custody_txn_id: custody_txn_id,
    });
  }

  async updateRedemptionRemarks(txnHash, remarks) {
    return this.makeNearRpcChangeCall("update_redemption_remarks", {
      txn_hash: txnHash,
      remarks: remarks,
    });
  }

  async createMintaBtcSignedTx(payloadHeader) {
    return this.makeNearRpcChangeCall("create_mint_abtc_signed_tx", {
      btc_txn_hash: payloadHeader.btc_txn_hash,
      nonce: payloadHeader.nonce,
      gas: payloadHeader.gas,
      max_fee_per_gas: payloadHeader.max_fee_per_gas,
      max_priority_fee_per_gas: payloadHeader.max_priority_fee_per_gas,
    });
  }

  async createRedeemAbtcTransaction(payloadHeader) {
    return this.makeNearRpcChangeCall("create_redeem_abtc_transaction", {
      sender: payloadHeader.sender,
      txn_hash: payloadHeader.txn_hash,
      utxos: payloadHeader.utxos,
      fee_rate: payloadHeader.fee_rate,
    });
  }

  async createRedeemAbtcSignedPayload(txn_hash, payload, psbt) {
    try {
      const r = await this.makeNearRpcChangeCall(
        "create_redeem_abtc_signed_payload",
        {
          txn_hash: txn_hash,
          payload: payload,
          psbt_data: psbt,
        },
      );

      return r;
    } catch (err) {
      const txnhash = err.context?.transactionHash;
      if (!txnhash) throw err;

      // if we have a transaction hash, we can wait until the transaction is confirmed
      const tx = await pRetry(
        async (count) => {
          const txnhash = err.context?.transactionHash;
          console.log(
            `NEAR createRedeemAbtcSignedPayload - retries: ${count} | ${txnhash}`,
          );
          return this.provider.txStatus(txnhash, this.contract_id, "FINAL");
        },
        { retries: 10 },
      );
      if (!tx || !tx.status || !tx.status.SuccessValue) throw err;

      const value = Buffer.from(tx.status.SuccessValue, "base64").toString(
        "utf-8",
      );
      return JSON.parse(value);
    }
  }

  async createMintAbtcTransaction(payloadHeader) {
    return this.makeNearRpcChangeCall("create_mint_abtc_transaction", {
      btc_txn_hash: payloadHeader.btc_txn_hash,
      nonce: payloadHeader.nonce,
      gas: payloadHeader.gas,
      max_fee_per_gas: payloadHeader.max_fee_per_gas,
      max_priority_fee_per_gas: payloadHeader.max_priority_fee_per_gas,
    });
  }

  // Function to get actual txn_hash when given a <abtc_redemption_chain_id>,<abtc_txn_hash> value
  async getRedemptionaBtcTxnHash(txnHash) {
    let [chainId, abtc_txn_hash] = txnHash.split(",");
    return abtc_txn_hash;
  }

  // Get the current block number
  async getCurrentBlockNumber() {
    const latestBlock = await this.provider.block({ finality: "final" });
    return latestBlock.header.height;
  }

  // Get the latest finalized block
  async getLatestBlock() {
    try {
      const latestBlock = await this.provider.block({ finality: "final" });
      return latestBlock;
    } catch (error) {
      console.error("Error fetching latest block:", error);
    }
  }

  // Get block by height
  async getBlockByHeight(height) {
    const block = await this.provider.block({ blockId: height });
    return block;
  }

  // Perform binary search to find block closest to the target timestamp
  // Perform binary search to find block closest to the target timestamp
  async getBlockNumberByTimestamp(targetTimestamp) {
    const latestBlock = await this.getLatestBlock();
    if (!latestBlock) {
      console.error("Failed to fetch the latest block.");
      return null;
    }

    let high = latestBlock.header.height;
    let low = high - 100000; // Start searching from 100,000 blocks before the latest block
    let bestBlock = null;
    let midBlock = null;
    let midTimestamp = 0;
    let test = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      try {
        midBlock = await this.getBlockByHeight(mid);
        test = midBlock.header.timestamp; // Convert from nanoseconds to seconds
        midTimestamp = Math.floor(midBlock.header.timestamp / 1_000_000_000); // Convert from nanoseconds to seconds

        console.log(
          `Checking block ${mid} with timestamp ${midTimestamp} - ${test}`,
        );

        // Check if exact match
        if (midTimestamp === targetTimestamp) {
          bestBlock = midBlock;
          break;
        }

        if (
          !bestBlock ||
          Math.abs(midTimestamp - targetTimestamp) <
            Math.abs(bestBlock.header.timestamp - targetTimestamp)
        ) {
          bestBlock = midBlock;
        }

        // Adjust binary search range
        if (midTimestamp < targetTimestamp) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      } catch (error) {
        console.warn(`Error fetching block at height ${mid}: ${error.message}`);
        if (error.message.includes("DB Not Found Error")) {
          // Adjust the range without updating bestBlock
          if (midTimestamp < targetTimestamp) {
            low++;
          } else {
            high--;
          }
          continue;
        } else {
          throw error; // Re-throw if it's a different type of error
        }
      }
    }

    // Return the block height closest to the target timestamp
    if (bestBlock) {
      console.log(
        `Closest block found: ${bestBlock.header.height} with timestamp ${bestBlock.header.timestamp}`,
      );
      return bestBlock.header.height;
    } else {
      console.error("Failed to find a suitable block.");
      return latestBlock.header.height; // Return the latest block as a fallback
    }
  }

  // Fetch mint events in batches by parsing the memo field, but only from a specific contract address
  async getPastMintEventsInBatches(startBlock, endBlock) {
    const events = [];
    const targetContractId = this.contract_id;

    for (let blockHeight = startBlock; blockHeight <= endBlock; blockHeight++) {
      try {
        const block = await this.provider.block({ blockId: blockHeight });
        for (const chunk of block.chunks) {
          if (chunk.tx_root === Near.TRANSACTION_ROOT) {
            //console.log(`No transactions in chunk ${chunk.chunk_hash}`);
            continue;
          }

          // Fetch the chunk using the chunk_hash
          const chunkData = await this.provider.chunk(chunk.chunk_hash);
          const transactions = chunkData.transactions;

          if (!transactions || transactions.length === 0) {
            console.warn(`No transactions found in chunk ${chunk.chunk_hash}`);
            continue;
          }

          for (const tx of transactions) {
            // console.log(`Processing transaction ${tx.hash} in block ${blockHeight}`);
            // console.log(tx.receiver_id);
            // Skip transactions that are not from the target contract address
            if (tx.receiver_id !== targetContractId) {
              console.log(`${tx.receiver_id} != ${targetContractId}`);
              continue;
            }

            const txResult = await this.provider.txStatus(
              tx.hash,
              tx.signer_id,
            );

            // Loop through the receipts_outcome array to find logs with 'ft_mint' event
            const receipt = txResult.receipts_outcome.find((outcome) =>
              outcome.outcome.logs.some((log) => {
                try {
                  // Parse the log and check if it contains the "ft_mint" event
                  const event = JSON.parse(log.replace("EVENT_JSON:", ""));
                  return event.event === "ft_mint";
                } catch (e) {
                  return false; // In case log is not a JSON string
                }
              }),
            );

            if (receipt && receipt.outcome.status.SuccessValue === "") {
              // Extract the log containing the JSON event
              const logEntry = receipt.outcome.logs.find((log) => {
                try {
                  const event = JSON.parse(log.replace("EVENT_JSON:", ""));
                  return event.event === "ft_mint";
                } catch (e) {
                  return false;
                }
              });

              if (logEntry) {
                // Parse the JSON from the log entry
                const event = JSON.parse(logEntry.replace("EVENT_JSON:", ""));

                // Extract the memo field from the event data and parse it
                const memo = JSON.parse(event.data[0].memo);
                const btcTxnHash = memo.btc_txn_hash; // Extract btc_txn_hash
                const transactionHash = txResult.transaction.hash;

                events.push({ btcTxnHash, transactionHash });

                return events;
              }
            }
          }
        }
      } catch {
        continue;
      }
    }
    return events;
  }

  async getPastBurnRedemptionEventsInBatches(
    startBlock,
    endBlock,
    aBTCAddress,
  ) {
    const events = [];
    const targetContractId = aBTCAddress;

    for (let blockHeight = startBlock; blockHeight <= endBlock; blockHeight++) {
      try {
        const block = await this.provider.block({ blockId: blockHeight });
        for (const chunk of block.chunks) {
          if (chunk.tx_root === Near.TRANSACTION_ROOT) {
            //console.log(`No transactions in chunk ${chunk.chunk_hash}`);
            continue;
          }

          // Fetch the chunk using the chunk_hash
          const chunkData = await this.provider.chunk(chunk.chunk_hash);
          const transactions = chunkData.transactions;

          const txnCount = (transactions && transactions.length) || 0;

          if (txnCount === 0) {
            //console.warn(`No transactions found in chunk ${chunk.chunk_hash}`);
            continue;
          }

          for (const tx of transactions) {
            // console.log(`Processing transaction ${tx.hash} in block ${blockHeight}`);
            // Skip transactions that are not from the target contract address
            if (tx.receiver_id !== targetContractId) {
              // console.log(tx.receiver_id);
              // console.log(targetContractId);
              continue;
            }

            const txResult = await this.provider.txStatus(
              tx.hash,
              tx.signer_id,
            );

            // Loop through the receipts_outcome array to find logs with 'ft_burn_redeem' event
            const receipt = txResult.receipts_outcome.find((outcome) =>
              outcome.outcome.logs.some((log) => {
                try {
                  console.log("log: ");
                  console.log(log);
                  // Parse the log and check if it contains the "ft_burn_redeem" event
                  const event = JSON.parse(log.replace("EVENT_JSON:", ""));
                  return event.event === "ft_burn_redeem";
                } catch (e) {
                  return false; // In case log is not a JSON string
                }
              }),
            );

            if (receipt && receipt.outcome.status.SuccessValue === "") {
              // Extract the log containing the JSON event
              const logEntry = receipt.outcome.logs.find((log) => {
                try {
                  const event = JSON.parse(log.replace("EVENT_JSON:", ""));
                  return event.event === "ft_burn_redeem";
                } catch (e) {
                  return false;
                }
              });

              if (logEntry) {
                // Parse the JSON from the log entry
                const event = JSON.parse(logEntry.replace("EVENT_JSON:", ""));

                // Extract the memo field from the event data and parse it
                const memo = JSON.parse(event.data[0].memo);
                const amount = event.data[0].amount;
                const wallet = memo.address;
                const btcAddress = memo.btcAddress;
                const transactionHash = txResult.transaction.hash;

                var isValidAddress = address.isValidBTCAddress(btcAddress);
                if (!isValidAddress) {
                  console.error(
                    `[${transactionHash}] Invalid address: ${btcAddress} in block ${blockHeight}`,
                  );
                  continue;
                }

                events.push({
                  returnValues: {
                    amount,
                    wallet,
                    btcAddress,
                  },
                  transactionHash,
                  blockNumber: blockHeight,
                  timestamp: Math.floor(block.header.timestamp / 1000000000),
                  status: true,
                });

                return events;
              }
            }
          }
        }
      } catch (err) {
        console.error(`${blockHeight} - ${err}`);
        continue;
      }
    }
    return events;
  }

  async createAcceptOwnershipTx(params) {
    return this.makeNearRpcChangeCall(
      "create_abtc_accept_ownership_tx",
      params,
    );
  }

  async withdrawFailDepositByBtcTxHash(params) {
    return this.makeNearRpcChangeCall(
      "withdraw_fail_deposit_by_btc_tx_hash",
      params,
    );
  }

  async rollbackDepositStatusByBtcTxnHash(params) {
    return this.makeNearRpcChangeCall(
      "rollback_deposit_status_by_btc_txn_hash",
      params,
    );
  }

  async updateDepositCustodyTxnId(btc_txn_hash, custody_txn_id) {
    return this.makeNearRpcChangeCall("update_deposit_custody_txn_id", {
      btc_txn_hash,
      custody_txn_id,
    });
  }

  async updateWithdrawFailDepositStatus(btc_txn_hash, timestamp) {
    return this.makeNearRpcChangeCall("update_withdraw_fail_deposit_status", {
      btc_txn_hash,
      timestamp,
    });
  }
}

module.exports = { Near };
