const {
  connect,
  keyStores,
  KeyPair,
  Contract,
  providers,
} = require("near-api-js");
const _ = require("lodash");
const pRetry = require("p-retry");

const { InMemoryKeyStore } = keyStores;

const { getPrice } = require("../coin");
const { MemoryCache } = require("../cache");

const address = require("./address");

const cache = new MemoryCache();

debugBridgeMint = require("debug")("bridge:getPastMintBridgeEventsInBatches");
debugBridgeBurn = require("debug")("bridge:getPastBurnBridgingEventsInBatches");

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
    bitHiveContractId,
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
    this.bitHiveContractId = bitHiveContractId;
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
          "get_bridging_by_txn_hash",
          "get_all_bridgings",
          "get_first_valid_bridging_chain_config",
          "get_first_valid_user_deposit",
          "get_first_valid_user_redemption",
          "get_first_valid_bridging_fees_unstake",
          "get_first_valid_bridging_fees_unstaked",
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
          "insert_bridging_abtc",
          "update_bridging_status",
          "update_bridging_btc_bridged",
          "update_bridging_remarks",
          "create_bridging_abtc_signed_tx",
          "update_bridging_minted",
          "create_deposit_bithive_signed_payload",
          "create_withdrawal_bithive_unstake_message_signed_payload",
          "update_deposit_yield_provider_deposited",
          "update_deposit_pending_yield_provider_deposit",
          "update_yield_provider_txn_hash",
          "update_redemption_pending_yield_provider_unstake",
          "update_redemption_yield_provider_unstaked",
          "update_redemption_yield_provider_unstake_processing",
          "update_redemption_pending_yield_provider_withdraw",
          "update_redemption_yield_provider_withdrawing",
          "update_redemption_yield_provider_withdrawn",
          "create_abtc_accept_ownership_tx",
          "withdraw_fail_deposit_by_btc_tx_hash",
          "rollback_deposit_status_by_btc_txn_hash",
          "update_bridging_fees_pending_yield_provider_unstake",
          "update_bridging_fees_yield_provider_unstake_processing",
          "update_bridging_fees_yield_provider_remarks",
          "update_bridging_fees_yield_provider_unstaked",
          "update_bridging_fees_pending_yield_provider_withdraw",
          "update_bridging_fees_yield_provider_withdrawing",
          "update_bridging_fees_yield_provider_withdrawn",
        ],
      });

      this.nearMPCContract = new Contract(this.account, this.mpcContractId, {
        viewMethods: ["public_key"],
        changeMethods: ["sign"],
      });

      this.bitHiveContract = new Contract(
        this.account,
        this.bitHiveContractId,
        {
          viewMethods: ["get_deposit", "view_account", "get_summary"],
        },
      );
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

  // Function to get all redemptions from NEAR contract
  async getAllBridgings() {
    return this.makeNearRpcViewCall("get_all_bridgings", {});
  }

  async getBridgingByTxnHash(transactionHash) {
    return this.makeNearRpcViewCall("get_bridging_by_txn_hash", {
      txn_hash: transactionHash,
    });
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

  async getFirstValidUserDeposit() {
    return this.makeNearRpcViewCall("get_first_valid_user_deposit", {});
  }

  async getFirstValidUserRedemption() {
    return this.makeNearRpcViewCall("get_first_valid_user_redemption", {});
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

  async updateDepositYieldProviderDeposited(btcTxnHash, timestamp) {
    return this.makeNearRpcChangeCall(
      "update_deposit_yield_provider_deposited",
      {
        btc_txn_hash: btcTxnHash,
      },
    );
  }

  async updateDepositPendingYieldProviderDeposit(btcTxnHash) {
    return this.makeNearRpcChangeCall(
      "update_deposit_pending_yield_provider_deposit",
      {
        btc_txn_hash: btcTxnHash,
      },
    );
  }

  async updateRedemptionPendingYieldProviderUnstake(txnHash) {
    return this.makeNearRpcChangeCall(
      "update_redemption_pending_yield_provider_unstake",
      {
        txn_hash: txnHash,
      },
    );
  }

  async updateRedemptionYieldProviderUnstaked(txnHash) {
    return this.makeNearRpcChangeCall(
      "update_redemption_yield_provider_unstaked",
      {
        txn_hash: txnHash,
      },
    );
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
    protocolFee,
    mintedTxnHash,
    mintingFee,
    timestamp,
    remarks,
    date_created,
    yieldProviderGasFee,
    yieldProviderTxnHash,
  ) {
    return this.makeNearRpcChangeCall("insert_deposit_btc", {
      btc_txn_hash: btcTxnHash,
      btc_sender_address: btcSenderAddress,
      receiving_chain_id: receivingChainID,
      receiving_address: receivingAddress,
      btc_amount: btcAmount,
      protocol_fee: protocolFee,
      minted_txn_hash: mintedTxnHash,
      minting_fee: mintingFee,
      timestamp: timestamp,
      remarks: remarks,
      date_created: date_created,
      yield_provider_gas_fee: yieldProviderGasFee,
      yield_provider_txn_hash: yieldProviderTxnHash,
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
  ) {
    return this.makeNearRpcChangeCall("insert_redemption_abtc", {
      txn_hash: transactionHash,
      abtc_redemption_address: aBtcRedemptionAddress,
      abtc_redemption_chain_id: aBtcRedemptionChainId,
      btc_receiving_address: btcAddress,
      abtc_amount: amount,
      timestamp: timestamp,
      date_created: date_created,
    });
  }

  async updateRedemptionStart(txnHash) {
    return this.makeNearRpcChangeCall("update_redemption_start", {
      txn_hash: txnHash,
    });
  }

  async updateRedemptionPendingBtcMempool(
    redemptionTxnHash,
    btcTxnHash,
    estimatedFee,
    protocolFee,
  ) {
    console.log(redemptionTxnHash);
    console.log(btcTxnHash);
    return this.makeNearRpcChangeCall("update_redemption_pending_btc_mempool", {
      txn_hash: redemptionTxnHash,
      btc_txn_hash: btcTxnHash,
      estimated_fee: estimatedFee,
      protocol_fee: protocolFee,
    });
  }

  async updateRedemptionRedeemed(redemptionTxnHash) {
    return this.makeNearRpcChangeCall("update_redemption_redeemed", {
      txn_hash: redemptionTxnHash,
    });
  }

  async updateRedemptionYieldProviderTxnHash(txnHash, yield_provider_txn_hash) {
    console.log(txnHash);
    console.log(yield_provider_txn_hash);
    return this.makeNearRpcChangeCall(
      "update_redemption_yield_provider_txn_hash",
      {
        txn_hash: txnHash,
        yield_provider_txn_hash: yield_provider_txn_hash,
      },
    );
  }

  async updateRedemptionYieldProviderUnstakeProcessing(
    txnHash,
    bithiveDepositTxHash,
  ) {
    return this.makeNearRpcChangeCall(
      "update_redemption_yield_provider_unstake_processing",
      {
        txn_hash: txnHash,
      },
    );
  }

  async updateRedemptionPendingYieldProviderWithdraw(txnHash) {
    return this.makeNearRpcChangeCall(
      "update_redemption_pending_yield_provider_withdraw",
      {
        txn_hash: txnHash,
      },
    );
  }

  async updateRedemptionYieldProviderWithdrawing(
    txnHash,
    yieldProviderTxHash,
    yieldProviderGasFee,
  ) {
    return this.makeNearRpcChangeCall(
      "update_redemption_yield_provider_withdrawing",
      {
        txn_hash: txnHash,
        yield_provider_gas_fee: yieldProviderGasFee,
        yield_provider_txn_hash: yieldProviderTxHash,
      },
    );
  }

  async updateRedemptionWithdrawnFromYieldProvider(txnHash) {
    return this.makeNearRpcChangeCall(
      "update_redemption_yield_provider_withdrawn",
      {
        txn_hash: txnHash,
      },
    );
  }

  async updateRedemptionRemarks(txnHash, remarks) {
    return this.makeNearRpcChangeCall("update_redemption_remarks", {
      txn_hash: txnHash,
      remarks: remarks,
    });
  }

  async createMintaBtcSignedTx(payloadHeader) {
    console.log(payloadHeader);
    return this.makeNearRpcChangeCall("create_mint_abtc_signed_tx", {
      btc_txn_hash: payloadHeader.btc_txn_hash,
      nonce: payloadHeader.nonce,
      gas: payloadHeader.gas,
      max_fee_per_gas: payloadHeader.max_fee_per_gas,
      max_priority_fee_per_gas: payloadHeader.max_priority_fee_per_gas,
    });
  }

  async createRedeemAbtcTransaction(payloadHeader) {
    // this one is safe to call multiples time because it only construct the tx

    return pRetry(
      () => {
        return this.makeNearRpcChangeCall("create_redeem_abtc_transaction", {
          sender: payloadHeader.sender,
          txn_hash: payloadHeader.txn_hash,
          utxos: payloadHeader.utxos,
          fee_rate: payloadHeader.fee_rate,
        });
      },
      { retries: 10 },
    );
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
    return Number(latestBlock.header.height);
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

  // // Fetch mint events in batches by parsing the memo field, but only from a specific contract address
  // async getPastMintEventsInBatches(startBlock, endBlock) {
  //   const events = [];
  //   const targetContractId = this.contract_id;

  //   for (let blockHeight = startBlock; blockHeight <= endBlock; blockHeight++) {
  //     try {
  //       const block = await this.provider.block({ blockId: blockHeight });
  //       for (const chunk of block.chunks) {
  //         if (chunk.tx_root === Near.TRANSACTION_ROOT) {
  //           //console.log(`No transactions in chunk ${chunk.chunk_hash}`);
  //           continue;
  //         }

  //         // Fetch the chunk using the chunk_hash
  //         const chunkData = await this.provider.chunk(chunk.chunk_hash);
  //         const transactions = chunkData.transactions;

  //         if (!transactions || transactions.length === 0) {
  //           console.warn(`No transactions found in chunk ${chunk.chunk_hash}`);
  //           continue;
  //         }

  //         for (const tx of transactions) {
  //           // console.log(`Processing transaction ${tx.hash} in block ${blockHeight}`);
  //           // console.log(tx.receiver_id);
  //           // Skip transactions that are not from the target contract address
  //           if (tx.receiver_id !== targetContractId) {
  //             console.log(`${tx.receiver_id} != ${targetContractId}`);
  //             continue;
  //           }

  //           const txResult = await this.provider.txStatus(
  //             tx.hash,
  //             tx.signer_id,
  //           );

  //           // Loop through the receipts_outcome array to find logs with 'ft_mint' event
  //           const receipt = txResult.receipts_outcome.find((outcome) =>
  //             outcome.outcome.logs.some((log) => {
  //               try {
  //                 // Parse the log and check if it contains the "ft_mint" event
  //                 const event = JSON.parse(log.replace("EVENT_JSON:", ""));
  //                 return event.event === "ft_mint";
  //               } catch (e) {
  //                 return false; // In case log is not a JSON string
  //               }
  //             }),
  //           );

  //           if (receipt && receipt.outcome.status.SuccessValue === "") {
  //             // Extract the log containing the JSON event
  //             const logEntry = receipt.outcome.logs.find((log) => {
  //               try {
  //                 const event = JSON.parse(log.replace("EVENT_JSON:", ""));
  //                 return event.event === "ft_mint";
  //               } catch (e) {
  //                 return false;
  //               }
  //             });

  //             if (logEntry) {
  //               // Parse the JSON from the log entry
  //               const event = JSON.parse(logEntry.replace("EVENT_JSON:", ""));

  //               // Extract the memo field from the event data and parse it
  //               const memo = JSON.parse(event.data[0].memo);
  //               const btcTxnHash = memo.btc_txn_hash; // Extract btc_txn_hash
  //               const transactionHash = txResult.transaction.hash;

  //               events.push({ btcTxnHash, transactionHash });

  //               return events;
  //             }
  //           }
  //         }
  //       }
  //     } catch {
  //       continue;
  //     }
  //   }
  //   return events;
  // }

  // async getPastMintBridgeEventsInBatches(startBlock, endBlock) {
  //   const targetContractId = this.contract_id;

  //   return fastscan(
  //     this.provider,
  //     async (chunk, blockId, blockTimestamp) => {
  //       debugBridgeMint(
  //         `${chunk.chunk_hash} -> ${blockId} -> ${blockTimestamp}`,
  //       );

  //       const events = [];
  //       if (chunk.tx_root === Near.TRANSACTION_ROOT) {
  //         return events;
  //       }

  //       // Fetch the chunk using the chunk_hash
  //       const chunkData = await this.provider.chunk(chunk.chunk_hash);
  //       const transactions = chunkData.transactions;

  //       const txnCount = (transactions && transactions.length) || 0;
  //       if (txnCount === 0) {
  //         return events;
  //       }

  //       for (const tx of transactions) {
  //         if (tx.receiver_id !== targetContractId) {
  //           continue;
  //         }

  //         const txResult = await this.provider.txStatus(tx.hash, tx.signer_id);

  //         // Loop through the receipts_outcome array to find logs with 'ft_mint_bridge' event
  //         const receipt = txResult.receipts_outcome.find((outcome) =>
  //           outcome.outcome.logs.some((log) => {
  //             try {
  //               // Parse the log and check if it contains the "ft_mint_bridge" event
  //               const event = JSON.parse(log.replace("EVENT_JSON:", ""));
  //               return event.event === "ft_mint_bridge";
  //             } catch (e) {
  //               return false; // In case log is not a JSON string
  //             }
  //           }),
  //         );

  //         if (receipt && receipt.outcome.status.SuccessValue === "") {
  //           // Extract the log containing the JSON event
  //           const logEntry = receipt.outcome.logs.find((log) => {
  //             try {
  //               const event = JSON.parse(log.replace("EVENT_JSON:", ""));
  //               return event.event === "ft_mint_bridge";
  //             } catch (e) {
  //               return false;
  //             }
  //           });

  //           if (logEntry) {
  //             // Parse the JSON from the log entry
  //             const event = JSON.parse(logEntry.replace("EVENT_JSON:", ""));

  //             // Extract the memo field from the event data and parse it
  //             const memo = JSON.parse(event.data[0].memo);
  //             const address = memo.address;
  //             const originChainId = memo.originChainId;
  //             const originChainAddress = memo.originChainAddress;
  //             const originTxnHash = memo.originTxnHash;
  //             const transactionHash = txResult.transaction.hash;

  //             const e = {
  //               address,
  //               originChainId,
  //               originChainAddress,
  //               originTxnHash,
  //               transactionHash,
  //               timestamp: blockTimestamp,
  //             };
  //             events.push(e);

  //             console.log(
  //               `${blockId} -> ${chunk.chunk_hash} -> ${transactionHash}`,
  //             );
  //           }
  //         }
  //       }

  //       return events;
  //     },
  //     startBlock,
  //     endBlock,
  //     50,
  //     3,
  //   );
  // }

  // async getPastBurnBridgingEventsInBatches(startBlock, endBlock, aBTCAddress) {
  //   const targetContractId = aBTCAddress;

  //   return fastscan(
  //     this.provider,
  //     async (chunk, blockId, blockTimestamp) => {
  //       debugBridgeBurn(
  //         `${chunk.chunk_hash} -> ${blockId} -> ${blockTimestamp}`,
  //       );

  //       const events = [];
  //       if (chunk.tx_root === Near.TRANSACTION_ROOT) {
  //         //console.log(`No transactions in chunk ${chunk.chunk_hash}`);
  //         return events;
  //       }

  //       // Fetch the chunk using the chunk_hash
  //       const chunkData = await this.provider.chunk(chunk.chunk_hash);
  //       const transactions = chunkData.transactions;

  //       const txnCount = (transactions && transactions.length) || 0;

  //       if (txnCount === 0) {
  //         return events;
  //       }

  //       for (const tx of transactions) {
  //         if (tx.receiver_id !== targetContractId) {
  //           continue;
  //         }

  //         const txResult = await this.provider.txStatus(tx.hash, tx.signer_id);

  //         // Loop through the receipts_outcome array to find logs with 'ft_burn_bridge' event
  //         const receipt = txResult.receipts_outcome.find((outcome) =>
  //           outcome.outcome.logs.some((log) => {
  //             try {
  //               // Parse the log and check if it contains the "ft_burn_bridge" event
  //               const event = JSON.parse(log.replace("EVENT_JSON:", ""));
  //               return event.event === "ft_burn_bridge";
  //             } catch (e) {
  //               return false; // In case log is not a JSON string
  //             }
  //           }),
  //         );

  //         if (receipt && receipt.outcome.status.SuccessValue === "") {
  //           // Extract the log containing the JSON event
  //           const logEntry = receipt.outcome.logs.find((log) => {
  //             try {
  //               const event = JSON.parse(log.replace("EVENT_JSON:", ""));
  //               return event.event === "ft_burn_bridge";
  //             } catch (e) {
  //               return false;
  //             }
  //           });

  //           if (logEntry) {
  //             // Parse the JSON from the log entry
  //             const event = JSON.parse(logEntry.replace("EVENT_JSON:", ""));

  //             // Extract the memo field from the event data and parse it
  //             const memo = JSON.parse(event.data[0].memo);
  //             const amount = event.data[0].amount;
  //             const wallet = memo.address;
  //             const destChainId = memo.destChainId;
  //             const destChainAddress = memo.destChainAddress;
  //             const mintingFeeSat = memo.mintingFeeSat;
  //             const bridgingFeeSat = memo.bridgingFeeSat;
  //             const transactionHash = txResult.transaction.hash;

  //             var isValidAddress =
  //               address.isValidEthereumAddress(destChainAddress) ||
  //               address.isValidNearAddress(destChainAddress);
  //             if (!isValidAddress) {
  //               console.error(
  //                 `[${transactionHash}] Invalid address: ${destChainAddress} in block ${blockHeight}`,
  //               );
  //               continue;
  //             }

  //             const e = {
  //               returnValues: {
  //                 amount,
  //                 wallet,
  //                 destChainId,
  //                 destChainAddress,
  //                 mintingFeeSat,
  //                 bridgingFeeSat,
  //               },
  //               transactionHash,
  //               blockNumber: blockId,
  //               timestamp: Math.floor(blockTimestamp / 1000000000),
  //               status: true,
  //             };

  //             console.log(
  //               `${blockId} -> ${chunk.chunk_hash} -> ${transactionHash}`,
  //             );
  //             events.push(e);
  //           }
  //         }
  //       }

  //       return events;
  //     },
  //     startBlock,
  //     endBlock,
  //     50,
  //     3,
  //   );
  // }

  // async getPastBurnRedemptionEventsInBatches(
  //   startBlock,
  //   endBlock,
  //   aBTCAddress,
  // ) {
  //   const events = [];
  //   const targetContractId = aBTCAddress;
  //   const batchSize = 50;
  //   let block_count = 0;

  //   while (startBlock <= endBlock) {
  //     try {
  //       // Define the end block for the current batch
  //       const batchEndBlock = Math.min(startBlock + batchSize - 1, endBlock);

  //       console.log(`[NEAR] Processing batch from ${startBlock} to ${batchEndBlock}`);

  //       // Create an array of promises for fetching blocks in the current batch
  //       const blockPromises = [];
  //       for (let blockHeight = startBlock; blockHeight <= batchEndBlock; blockHeight++) {
  //         blockPromises.push(
  //           this.provider.block({ blockId: blockHeight })
  //             .then(async (block) => {
  //               try {
  //                 for (const chunk of block.chunks) {
  //                   if (chunk.tx_root === Near.TRANSACTION_ROOT) {
  //                     continue;
  //                   }

  //                   const chunkData = await this.provider.chunk(chunk.chunk_hash);
  //                   const transactions = chunkData.transactions;

  //                   if (!transactions || transactions.length === 0) {
  //                     continue;
  //                   }

  //                   for (const tx of transactions) {
  //                     if (tx.receiver_id !== targetContractId) {
  //                       continue;
  //                     }

  //                     const txResult = await this.provider.txStatus(
  //                       tx.hash,
  //                       tx.signer_id,
  //                     );

  //                     const receipt = txResult.receipts_outcome.find((outcome) =>
  //                       outcome.outcome.logs.some((log) => {
  //                         try {
  //                           const event = JSON.parse(log.replace("EVENT_JSON:", ""));
  //                           return event.event === "ft_burn_redeem";
  //                         } catch (e) {
  //                           return false;
  //                         }
  //                       }),
  //                     );

  //                     if (receipt && receipt.outcome.status.SuccessValue === "") {
  //                       const logEntry = receipt.outcome.logs.find((log) => {
  //                         try {
  //                           const event = JSON.parse(log.replace("EVENT_JSON:", ""));
  //                           return event.event === "ft_burn_redeem";
  //                         } catch (e) {
  //                           return false;
  //                         }
  //                       });

  //                       if (logEntry) {
  //                         const event = JSON.parse(logEntry.replace("EVENT_JSON:", ""));
  //                         const memo = JSON.parse(event.data[0].memo);
  //                         const amount = event.data[0].amount;
  //                         const wallet = memo.address;
  //                         const btcAddress = memo.btcAddress;
  //                         const transactionHash = txResult.transaction.hash;

  //                         if (!address.isValidBTCAddress(btcAddress)) {
  //                           console.error(
  //                             `[${transactionHash}] Invalid address: ${btcAddress} in block ${blockHeight}`,
  //                           );
  //                           continue;
  //                         }

  //                         events.push({
  //                           returnValues: {
  //                             amount,
  //                             wallet,
  //                             btcAddress,
  //                           },
  //                           transactionHash,
  //                           blockNumber: blockHeight,
  //                           timestamp: Math.floor(block.header.timestamp / 1000000000),
  //                           status: true,
  //                         });
  //                       }
  //                     }
  //                   }
  //                 }
  //                 block_count++;

  //               } catch (err) {
  //                 console.error(`Error processing block: ${err}`);
  //               }
  //             })
  //             .catch((err) => {
  //               console.error(`Error fetching block ${blockHeight}: ${err}`);
  //               return null;
  //             })
  //         );
  //       }

  //       // Wait for all block fetch promises in the current batch to resolve
  //       await Promise.all(blockPromises);

  //       // Update start block for next batch
  //       startBlock = batchEndBlock + 1;

  //     } catch (err) {
  //       console.error(`Batch processing error: ${err}`);
  //       continue;
  //     }
  //   }
  //   console.log("events:", events);
  //   return events;
  // }

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

  async updateWithdrawFailDepositStatus(btc_txn_hash, timestamp) {
    return this.makeNearRpcChangeCall("update_withdraw_fail_deposit_status", {
      btc_txn_hash,
      timestamp,
    });
  }

  async insertBridgingAbtc(record) {
    return this.makeNearRpcChangeCall("insert_bridging_abtc", {
      txn_hash: record.txn_hash,
      origin_chain_id: record.origin_chain_id,
      origin_chain_address: record.origin_chain_address,
      dest_chain_id: record.dest_chain_id,
      dest_chain_address: record.dest_chain_address,
      dest_txn_hash: record.dest_txn_hash,
      abtc_amount: record.abtc_amount,
      timestamp: record.timestamp,
      status: record.status,
      remarks: record.remarks,
      date_created: record.date_created,
      minting_fee_sat: record.minting_fee_sat,
      yield_provider_gas_fee: record.yield_provider_gas_fee,
    });
  }

  async updateBridgingStatus(txnHash, status) {
    return this.makeNearRpcChangeCall("update_bridging_status", {
      btc_txn_hash: txnHash,
      status: status,
    });
  }

  async updateBridgingBtcBridged(txnHash, timestamp) {
    return this.makeNearRpcChangeCall("update_bridging_btc_bridged", {
      txn_hash: txnHash,
      timestamp: timestamp,
    });
  }

  async updateBridgingMinted(txnHash, destTxnHash, timestamp) {
    return this.makeNearRpcChangeCall("update_bridging_minted", {
      txn_hash: txnHash,
      dest_txn_hash: destTxnHash,
      timestamp: timestamp,
    });
  }

  async updateBridgingRemarks(txnHash, remarks) {
    return this.makeNearRpcChangeCall("update_bridging_remarks", {
      txn_hash: txnHash,
      remarks: remarks,
    });
  }

  async getFirstValidBridgingChainConfig() {
    return this.makeNearRpcViewCall("get_first_valid_bridging_chain_config");
  }

  async getFirstValidBridgingFeesUnstake() {
    return this.makeNearRpcViewCall("get_first_valid_bridging_fees_unstake");
  }

  async updateBridgingFeesPendingYieldProviderUnstake(txnHash) {
    return this.makeNearRpcChangeCall(
      "update_bridging_fees_pending_yield_provider_unstake",
      {
        txn_hash: txnHash,
      },
    );
  }

  async updateBridgingFeesYieldProviderRemarks(txnHash, remarks) {
    return this.makeNearRpcChangeCall(
      "update_bridging_fees_yield_provider_remarks",
      {
        txn_hash: txnHash,
        remarks: remarks,
      },
    );
  }

  async updateBridgingFeesYieldProviderUnstaked(txnHash) {
    return this.makeNearRpcChangeCall(
      "update_bridging_fees_yield_provider_unstaked",
      {
        txn_hash: txnHash,
      },
    );
  }

  async getFirstValidBridgingFeesUnstaked() {
    return this.makeNearRpcViewCall(
      "get_first_valid_bridging_fees_unstaked",
      {},
    );
  }

  async updateBridgingFeesPendingYieldProviderWithdraw(txnHash) {
    return this.makeNearRpcChangeCall(
      "update_bridging_fees_pending_yield_provider_withdraw",
      {
        txn_hash: txnHash,
      },
    );
  }

  async updateBridgingFeesYieldProviderWithdrawing(txnHash, depositTxHash) {
    return this.makeNearRpcChangeCall(
      "update_bridging_fees_yield_provider_withdrawing",
      {
        txn_hash: txnHash,
        yield_provider_txn_hash: depositTxHash,
      },
    );
  }

  async updateBridgingFeesYieldProviderWithdrawn(txnHash) {
    return this.makeNearRpcChangeCall(
      "update_bridging_fees_yield_provider_withdrawn",
      {
        txn_hash: txnHash,
      },
    );
  }

  async updateBridgingFeesYieldProviderUnstakeProcessing(txnHash) {
    return this.makeNearRpcChangeCall(
      "update_bridging_fees_yield_provider_unstake_processing",
      {
        txn_hash: txnHash,
      },
    );
  }

  async createMintBridgeABtcSignedTx(payloadHeader) {
    return this.makeNearRpcChangeCall("create_bridging_abtc_signed_tx", {
      txn_hash: payloadHeader.txn_hash,
      nonce: payloadHeader.nonce,
      gas: payloadHeader.gas,
      max_fee_per_gas: payloadHeader.max_fee_per_gas,
      max_priority_fee_per_gas: payloadHeader.max_priority_fee_per_gas,
    });
  }

  async createDepositBithiveSignedPayload(payload) {
    console.log("entered createDepositBithiveSignedPayload");
    console.log(payload);
    try {
      const r = await this.makeNearRpcChangeCall(
        "create_deposit_bithive_signed_payload",
        {
          payload: payload,
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
            `NEAR createDepositBithiveSignedPayload - retries: ${count} | ${txnhash}`,
          );
          return this.provider.txStatus(txnhash, this.contract_id, "FINAL");
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
      return JSON.parse(value);
    }
  }

  async createWithdrawalBithiveUnstakeMessageSignedPayload(payload) {
    console.log("entered createWithdrawalBithiveUnstakeMessageSignedPayload");
    console.log(payload);
    try {
      const r = await this.makeNearRpcChangeCall(
        "create_withdrawal_bithive_unstake_message_signed_payload",
        {
          payload: payload,
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
            `NEAR createDepositBithiveSignedPayload - retries: ${count} | ${txnhash}`,
          );
          return this.provider.txStatus(txnhash, this.contract_id, "FINAL");
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
      return JSON.parse(value);
    }
  }

  async updateYieldProviderTxnHash(btcTxnHash, yieldProviderTxnHash) {
    return this.makeNearRpcChangeCall("update_yield_provider_txn_hash", {
      btc_txn_hash: btcTxnHash,
      yield_provider_txn_hash: yieldProviderTxnHash,
    });
  }

  async calculateNearGasFeeFromMintingFee(receiver, mintingFeeSat) {
    console.log("receiver:", receiver);
    console.log("mintingFeeSat:", mintingFeeSat);

    const btcPriceUsd = await cache.wrap(getPrice)("bitcoin", "usd");
    const nearPrice = await cache.wrap(getPrice)("near", "usd");

    console.log("btcPriceUsd:", btcPriceUsd);
    console.log("nearPrice:", nearPrice);

    // Convert sats to USD
    const mintingFeeUsd = Number(
      ((mintingFeeSat / 100_000_000) * btcPriceUsd).toFixed(4),
    );

    // Convert USD to NEAR (1 NEAR = $2.95 USD)
    const mintingFeeNear = mintingFeeUsd / nearPrice;

    // Convert NEAR to Tgas (1 NEAR = 1000 Tgas)
    const mintingFeeTgas = mintingFeeNear * 1000;

    console.log("mintingFeeNear:", mintingFeeNear);
    console.log("mintingFeeUsd:", mintingFeeUsd);
    console.log("mintingFeeTgas:", mintingFeeTgas);

    return {
      gasPrice: Math.floor(mintingFeeTgas), // Return Tgas as integer
      mintingFeeUsd: Number(mintingFeeUsd),
    };
  }

  async getPastEventsInBatches(
    startBlock,
    endBlock,
    atBtcContractId,
    eventType = "all",
  ) {
    const events = [];
    const targetContractId = this.contract_id;

    const batchSize = 50;
    let block_count = 0;

    while (startBlock <= endBlock) {
      try {
        // Define the end block for the current batch
        const batchEndBlock = Math.min(startBlock + batchSize - 1, endBlock);

        console.log(
          `[NEAR] Processing batch from ${startBlock} to ${batchEndBlock}`,
        );

        // Create an array of promises for fetching blocks in the current batch
        const blockPromises = [];
        for (
          let blockHeight = startBlock;
          blockHeight <= batchEndBlock;
          blockHeight++
        ) {
          blockPromises.push(
            this.provider
              .block({ blockId: blockHeight })
              .then(async (block) => {
                try {
                  for (const chunk of block.chunks) {
                    if (chunk.tx_root === Near.TRANSACTION_ROOT) {
                      continue;
                    }

                    const chunkData = await this.provider.chunk(
                      chunk.chunk_hash,
                    );
                    const transactions = chunkData.transactions;

                    if (!transactions || transactions.length === 0) {
                      continue;
                    }

                    for (const tx of transactions) {
                      if (
                        tx.receiver_id !== targetContractId &&
                        tx.receiver_id !== atBtcContractId
                      ) {
                        continue;
                      }

                      const txResult = await this.provider.txStatus(
                        tx.hash,
                        tx.signer_id,
                      );

                      for (const outcome of txResult.receipts_outcome) {
                        if (outcome.outcome.status.SuccessValue !== "") {
                          continue;
                        }

                        for (const log of outcome.outcome.logs) {
                          try {
                            if (!log.startsWith("EVENT_JSON:")) continue;

                            const eventJson = JSON.parse(
                              log.replace("EVENT_JSON:", ""),
                            );
                            const eventName = eventJson.event;

                            // Filter by event type if specified
                            if (eventType !== "all") {
                              const eventMap = {
                                mint: "ft_mint",
                                mint_bridge: "ft_mint_bridge",
                                redemption: "ft_burn_redeem",
                                bridging: "ft_burn_bridge",
                              };
                              if (eventName !== eventMap[eventType]) continue;
                            }

                            const event = JSON.parse(
                              log.replace("EVENT_JSON:", ""),
                            );
                            const memo = JSON.parse(event.data[0].memo);
                            const transactionHash = txResult.transaction.hash;
                            const timestamp = Math.floor(
                              block.header.timestamp / 1000000000,
                            );

                            let processedEvent = null;

                            switch (eventName) {
                              case "ft_mint":
                                processedEvent = {
                                  type: "mint_redemption",
                                  btcTxnHash: memo.btc_txn_hash,
                                  transactionHash,
                                };
                                break;

                              case "ft_mint_bridge":
                                processedEvent = {
                                  type: "mint_bridge",
                                  address: memo.address,
                                  originChainId: memo.originChainId,
                                  originChainAddress: memo.originChainAddress,
                                  originTxnHash: memo.originTxnHash,
                                  transactionHash,
                                  timestamp,
                                };
                                break;

                              case "ft_burn_redeem":
                                if (
                                  !address.isValidBTCAddress(memo.btcAddress)
                                ) {
                                  console.error(
                                    `[${transactionHash}] Invalid BTC address: ${memo.btcAddress} in block ${blockHeight}`,
                                  );
                                  continue;
                                }
                                processedEvent = {
                                  type: "burn_redemption",
                                  returnValues: {
                                    amount: event.data[0].amount,
                                    wallet: memo.address,
                                    btcAddress: memo.btcAddress,
                                  },
                                  transactionHash,
                                  blockNumber: blockHeight,
                                  timestamp,
                                  status: true,
                                };
                                break;

                              case "ft_burn_bridge":
                                const isValidAddress =
                                  address.isValidEthereumAddress(
                                    memo.destChainAddress,
                                  ) ||
                                  address.isValidNearAddress(
                                    memo.destChainAddress,
                                  );

                                if (!isValidAddress) {
                                  console.error(
                                    `[${transactionHash}] Invalid destination address: ${memo.destChainAddress} in block ${blockHeight}`,
                                  );
                                  continue;
                                }
                                processedEvent = {
                                  type: "burn_bridging",
                                  returnValues: {
                                    amount: event.data[0].amount,
                                    wallet: memo.address,
                                    destChainId: memo.destChainId,
                                    destChainAddress: memo.destChainAddress,
                                    mintingFeeSat: memo.mintingFeeSat,
                                    bridgingFeeSat: memo.bridgingFeeSat,
                                  },
                                  transactionHash,
                                  blockNumber: blockHeight,
                                  timestamp,
                                  status: true,
                                };
                                break;
                            }

                            if (processedEvent) {
                              console.log(
                                `${blockHeight} -> ${chunk.chunk_hash} -> ${processedEvent.transactionHash}`,
                              );
                              console.log("Found event:", processedEvent);
                              events.push(processedEvent);
                            }
                          } catch (e) {
                            console.error(`Error processing log: ${e}`);
                            continue;
                          }
                        }
                      }
                    }
                  }
                  block_count++;
                } catch (err) {
                  console.error(`Error processing block: ${err}`);
                }
              })
              .catch((err) => {
                console.error(`Error fetching block ${blockHeight}: ${err}`);
                return null;
              }),
          );
        }

        // Wait for all block fetch promises in the current batch to resolve
        await Promise.all(blockPromises);

        // Update start block for next batch
        startBlock = batchEndBlock + 1;
      } catch (err) {
        console.error(`Batch processing error: ${err}`);
        continue;
      }
    }
    console.log("events:", events);
    return events;
  }
}

module.exports = { Near };

async function fastscan(provider, parse, from, to, size, concurrency) {
  const ranges = _.range(from, to, size);

  const items = [];
  for (let i = 0; i < ranges.length; i += 1) {
    items.push({ from: ranges[i], to: Math.min(ranges[i] + size - 1, to) });
  }

  const events = [];

  const chunk = _.chunk(items, concurrency);
  for (let i = 0; i < chunk.length; i++) {
    const found = await Promise.all(
      chunk[i].map(async (x) => scan(provider, parse, x.from, x.to)),
    );
    events.push(..._.flatten(found));
  }

  return events;
}

async function scan(provider, parse, fromBlock, toBlock) {
  const events = [];

  for (let blockId = fromBlock; blockId <= toBlock; blockId++) {
    const block = await provider.block({ blockId }).catch((err) => {
      return null;
    });
    if (!block) continue;

    for (const chunk of block.chunks) {
      const found = await parse(
        chunk,
        block.header.height,
        block.header.timestamp,
      );
      events.push(...found);
    }
  }

  return events;
}
