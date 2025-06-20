use crate::atlas::Atlas;
use crate::constants::delimiter::COMMA;
use crate::constants::near_gas::*;
use crate::constants::network_type::*;
use crate::constants::status::*;
use crate::modules::signer::*;
use crate::modules::structs::DepositRecord;
use crate::AtlasExt;
use crate::UtxoInput;
use crate::WithDrawFailDepositResult;
use bitcoin::blockdata::transaction::{Transaction, TxOut};
use bitcoin::consensus::encode::serialize;
use bitcoin::util::address::Address;
use bitcoin::util::psbt::PartiallySignedTransaction as Psbt;
use ethers_core::types::{H160, U256};
use hex::FromHex;
use near_sdk::env::keccak256;
use near_sdk::{
    env, log, near_bindgen, AccountId, Gas, NearToken, Promise, PromiseError, PromiseOrValue,
};
use omni_transaction::evm::evm_transaction::EVMTransaction;
use omni_transaction::evm::types::Signature as OmniSignature;
use omni_transaction::evm::utils::parse_eth_address;
use omni_transaction::transaction_builder::{
    TransactionBuilder as OmniTransactionBuilder, TxBuilder,
};
use omni_transaction::types::EVM;
use serde_json::json;
use std::str::FromStr;

#[near_bindgen]
impl Atlas {
    /// Inserts a new BTC deposit record into the system
    /// @param btc_txn_hash - The Bitcoin transaction hash that contains the deposit
    /// @param btc_sender_address - The Bitcoin address that sent the funds
    /// @param receiving_chain_id - The target blockchain where aBTC will be minted
    /// @param receiving_address - The address on the target chain to receive the aBTC
    /// @param btc_amount - The amount of BTC in satoshis
    /// @param protocol_fee - Fee charged by the Atlas protocol
    /// @param minted_txn_hash - Transaction hash of the aBTC mint (empty initially)
    /// @param minting_fee - Fee for minting aBTC on the target chain
    /// @param timestamp - Unix timestamp when the deposit was created
    /// @param remarks - Additional notes or error messages
    /// @param date_created - Unix timestamp for record creation
    /// @param yield_provider_gas_fee - Gas fee for yield provider operations
    /// @param yield_provider_txn_hash - Transaction hash for yield provider (empty initially)
    /// # Requirements
    /// * Caller must be an admin
    /// * Contract must not be paused
    /// * All mandatory fields must be non-empty
    /// * BTC amount must be greater than zero
    /// * Transaction hash must be unique
    /// * Minted and yield provider transaction hashes must be empty initially
    pub fn insert_deposit_btc(
        &mut self,
        btc_txn_hash: String,
        btc_sender_address: String,
        receiving_chain_id: String,
        receiving_address: String,
        btc_amount: u64,
        protocol_fee: u64,
        minted_txn_hash: String,
        minting_fee: u64,
        timestamp: u64,
        remarks: String,
        date_created: u64,
        yield_provider_gas_fee: u64,
        yield_provider_txn_hash: String,
    ) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate mandatory input fields
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        assert!(
            !btc_sender_address.is_empty(),
            "Sender address cannot be empty"
        );
        assert!(
            !receiving_chain_id.is_empty(),
            "Receiving chain ID cannot be empty"
        );
        assert!(
            !receiving_address.is_empty(),
            "Receiving address cannot be empty"
        );
        assert!(btc_amount > 0, "BTC amount must be greater than zero");
        assert!(
            minted_txn_hash.is_empty(),
            "Minted transaction hash must be empty"
        );
        assert!(timestamp > 0, "Timestamp must be greater than zero");
        assert!(date_created > 0, "Date created must be greater than zero");
        assert!(
            yield_provider_gas_fee > 0,
            "Yield provider gas fee must be greater than zero"
        );
        assert!(
            yield_provider_txn_hash.is_empty(),
            "Yield provider transaction hash must be empty"
        );

        // Check for duplicate transaction hash
        if self.deposits.contains_key(&btc_txn_hash) {
            env::panic_str("Deposit with this transaction hash already exists");
        }
        assert!(minting_fee > 0, "Minting fee must be greater than zero");

        let record = DepositRecord {
            btc_txn_hash: btc_txn_hash.clone(),
            btc_sender_address,
            receiving_chain_id,
            receiving_address,
            btc_amount,
            protocol_fee,
            minted_txn_hash,
            minting_fee,
            timestamp,
            status: DEP_BTC_PENDING_MEMPOOL,
            remarks,
            date_created,
            verified_count: 0,
            yield_provider_gas_fee,
            yield_provider_txn_hash,
            retry_count: 0,
            minted_txn_hash_verified_count: 0,
            refund_txn_id: "".to_string(),
        };

        self.deposits.insert(btc_txn_hash, record);
    }

    /// Retrieves a deposit record by its BTC transaction hash
    /// @param btc_txn_hash - The Bitcoin transaction hash to look up
    /// @returns Option<DepositRecord> - The deposit record if found, None otherwise
    /// # Requirements
    /// * BTC transaction hash must not be empty
    pub fn get_deposit_by_btc_txn_hash(&self, btc_txn_hash: String) -> Option<DepositRecord> {
        // Validate that the btc_txn_hash is not empty
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );

        self.deposits.get(&btc_txn_hash).cloned()
    }

    /// Returns the final BTC amount after subtracting all fees (protocol fee, yield provider gas fee, and minting fee)
    /// @param btc_txn_hash - The BTC transaction hash to look up
    /// @returns u64 - The final BTC amount after all fees are subtracted
    /// # Requirements
    /// * BTC transaction hash must not be empty
    /// * Deposit record must exist
    /// * Fee calculation must not overflow
    pub fn get_atbtc_minted(&self, btc_txn_hash: String) -> u64 {
        // Validate that the btc_txn_hash is not empty
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );

        // Get the deposit record
        if let Some(deposit) = self.deposits.get(&btc_txn_hash) {
            // Calculate final amount by subtracting all fees
            deposit
                .btc_amount
                .checked_sub(deposit.protocol_fee)
                .and_then(|amount| amount.checked_sub(deposit.yield_provider_gas_fee))
                .and_then(|amount| amount.checked_sub(deposit.minting_fee))
                .unwrap_or_else(|| env::panic_str("Arithmetic overflow in fee calculation"))
        } else {
            env::panic_str("Deposit record not found")
        }
    }

    /// Returns the total number of deposit records in the system
    /// @returns u64 - The total count of deposit records
    pub fn get_deposits_count(&self) -> u64 {
        self.deposits.len() as u64
    }

    /// Retrieves a paginated list of all deposit records
    /// @param from_index - Optional starting index for pagination (defaults to 0)
    /// @param limit - Optional maximum number of records to return (defaults to 1000)
    /// @returns Vec<DepositRecord> - A vector of deposit records
    pub fn get_all_deposits(
        &self,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<DepositRecord> {
        let start = from_index.unwrap_or(0) as usize;
        let page_size = limit.unwrap_or(1000) as usize; // Default to 50 records per page

        self.deposits
            .values()
            .skip(start)
            .take(page_size)
            .cloned()
            .collect()
    }

    /// Updates a deposit status to indicate BTC has been deposited into Atlas
    /// @param btc_txn_hash - The Bitcoin transaction hash to update
    /// @param timestamp - Unix timestamp when the status was updated
    /// # Requirements
    /// * Caller must be an admin
    /// * Contract must not be paused
    /// * Deposit must exist and be in pending mempool status
    /// * Deposit must have no remarks and no minted transaction hash
    pub fn update_deposit_btc_deposited(&mut self, btc_txn_hash: String, timestamp: u64) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        assert!(timestamp > 0, "Timestamp must be greater than zero");

        // Check if the deposit exists for the given btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            // Check all specified conditions
            if deposit.status == DEP_BTC_PENDING_MEMPOOL
                && deposit.remarks.is_empty()
                && deposit.minted_txn_hash.is_empty()
            {
                // All conditions are met, proceed to update the deposit status
                deposit.status = DEP_BTC_DEPOSITED_INTO_ATLAS;
                deposit.timestamp = timestamp;
                self.deposits.insert(btc_txn_hash.clone(), deposit);
                log!(
                    "Deposit status updated to DEP_BTC_DEPOSITED_INTO_ATLAS for btc_txn_hash: {}",
                    btc_txn_hash
                );
            } else {
                // Log a message if conditions are not met
                log!(
                    "Conditions not met for updating deposit status for btc_txn_hash: {}. 
                      Status: {}, Remarks: {}, Minted txn hash: {}",
                    btc_txn_hash,
                    deposit.status,
                    deposit.remarks,
                    deposit.minted_txn_hash
                );
            }
        } else {
            env::panic_str("Deposit record not found");
        }
    }

    /// Updates the minted transaction hash for a deposit and transitions to pending minted status
    /// @param btc_txn_hash - The Bitcoin transaction hash to update
    /// @param minted_txn_hash - The transaction hash of the aBTC minting transaction
    /// # Requirements
    /// * Caller must be an admin
    /// * Contract must not be paused
    /// * Deposit must be in pending minted or yield provider deposited status
    /// * Verified count must meet validator threshold
    /// * Deposit must have no remarks and no existing minted transaction hash
    pub fn update_deposit_minted_txn_hash(
        &mut self,
        btc_txn_hash: String,
        minted_txn_hash: String,
    ) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        assert!(
            !minted_txn_hash.is_empty(),
            "Minted transaction hash cannot be empty"
        );

        // Check if the deposit exists for the given btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            // Fetch chain configuration for the bitcoin deposit
            let chain_id = if self.is_production_mode() {
                BITCOIN.to_string()
            } else {
                TESTNET4.to_string()
            };

            if let Some(chain_config) = self.chain_configs.get_chain_config(chain_id.clone()) {
                // Check all specified conditions
                if (deposit.status == DEP_BTC_PENDING_MINTED_INTO_ABTC
                    || deposit.status == DEP_BTC_YIELD_PROVIDER_DEPOSITED)
                    && deposit.verified_count >= chain_config.validators_threshold
                    && deposit.remarks.is_empty()
                    && deposit.minted_txn_hash.is_empty()
                {
                    // All conditions are met, proceed to update the minted transaction hash
                    deposit.status = DEP_BTC_PENDING_MINTED_INTO_ABTC;
                    deposit.timestamp = env::block_timestamp() / 1_000_000_000;
                    deposit.minted_txn_hash = minted_txn_hash.clone();

                    // Calculate the amount before moving deposit
                    let mut amount = deposit.btc_amount;
                    amount = amount.saturating_sub(deposit.minting_fee);
                    amount = amount.saturating_sub(deposit.protocol_fee);
                    amount = amount.saturating_sub(deposit.yield_provider_gas_fee);

                    let receiving_address = deposit.receiving_address.clone();
                    let receiving_chain_id = deposit.receiving_chain_id.clone();

                    self.deposits.insert(btc_txn_hash.clone(), deposit);
                    log!(
                        "minted txn hash: {} updated for btc_txn_hash: {}",
                        minted_txn_hash,
                        btc_txn_hash
                    );

                    self.update_balance(receiving_address, receiving_chain_id, amount);
                } else {
                    // Log a message if conditions are not met
                    log!(
                        "Conditions not met for updating deposit minted txn hash for btc_txn_hash: {}. 
                         Status: {}, Verified count: {}, Remarks: {}, Minted txn hash: {}",
                        btc_txn_hash,
                        deposit.status,
                        deposit.verified_count,
                        deposit.remarks,
                        deposit.minted_txn_hash
                    );
                }
            } else {
                env::panic_str("Chain configuration not found for receiving chain ID");
            }
        } else {
            env::panic_str("Deposit record not found");
        }
    }

    /// Updates a deposit status to indicate it has been deposited to the yield provider
    /// @param btc_txn_hash - The Bitcoin transaction hash to update
    /// # Requirements
    /// * Caller must be an admin
    /// * Contract must not be paused
    /// * Deposit must be in pending yield provider deposit status
    /// * Verified count must meet validator threshold
    /// * Deposit must have no remarks and no minted transaction hash
    pub fn update_deposit_yield_provider_deposited(&mut self, btc_txn_hash: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );

        // Check if the deposit exists for the given btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            // Fetch chain configuration for the bitcoin deposit
            let chain_id = if self.is_production_mode() {
                BITCOIN.to_string()
            } else {
                TESTNET4.to_string()
            };

            if let Some(chain_config) = self.chain_configs.get_chain_config(chain_id.clone()) {
                // Check all specified conditions including validator threshold
                if deposit.status == DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT
                    && deposit.remarks.is_empty()
                    && deposit.minted_txn_hash.is_empty()
                    && deposit.verified_count >= chain_config.validators_threshold
                {
                    // All conditions are met, proceed to update the deposit status
                    deposit.status = DEP_BTC_YIELD_PROVIDER_DEPOSITED;
                    deposit.timestamp = env::block_timestamp() / 1_000_000_000;
                    self.deposits.insert(btc_txn_hash.clone(), deposit);
                    log!(
                        "Deposit status updated to DEP_BTC_YIELD_PROVIDER_DEPOSITED for btc_txn_hash: {}",
                        btc_txn_hash
                    );
                } else {
                    // Log a message if conditions are not met
                    log!(
                        "Conditions not met for updating deposit status for btc_txn_hash: {}. 
                          Status: {}, Remarks: {}, Minted txn hash: {}, Verified count: {}, Threshold: {}",
                        btc_txn_hash,
                        deposit.status,
                        deposit.remarks,
                        deposit.minted_txn_hash,
                        deposit.verified_count,
                        chain_config.validators_threshold
                    );
                }
            } else {
                env::panic_str("Chain configuration not found for receiving chain ID");
            }
        } else {
            env::panic_str("Deposit record not found");
        }
    }

    /// Updates a deposit status to indicate aBTC has been successfully minted
    /// @param btc_txn_hash - The Bitcoin transaction hash to update
    /// @param minted_txn_hash - The transaction hash of the confirmed aBTC mint
    /// # Requirements
    /// * Caller must be an admin
    /// * Contract must not be paused
    /// * Deposit must be in pending minted status
    /// * Both BTC and target chain validator thresholds must be met
    /// * Deposit must have no remarks and match the provided minted transaction hash
    pub fn update_deposit_minted(&mut self, btc_txn_hash: String, minted_txn_hash: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        assert!(
            !minted_txn_hash.is_empty(),
            "Minted transaction hash cannot be empty"
        );

        // Check if the deposit exists for the given btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            // Fetch chain configuration for the bitcoin deposit
            let btc_chain_id = if self.is_production_mode() {
                BITCOIN.to_string()
            } else {
                TESTNET4.to_string()
            };

            if let Some(btc_chain_config) =
                self.chain_configs.get_chain_config(btc_chain_id.clone())
            {
                // Fetch chain configuration for the deposit's receiving_chain_id
                if let Some(chain_config) = self
                    .chain_configs
                    .get_chain_config(deposit.receiving_chain_id.clone())
                {
                    // Check all specified conditions
                    if (deposit.status == DEP_BTC_PENDING_MINTED_INTO_ABTC)
                        && deposit.verified_count >= btc_chain_config.validators_threshold
                        && deposit.minted_txn_hash_verified_count
                            >= chain_config.validators_threshold
                        && deposit.remarks.is_empty()
                        && deposit.minted_txn_hash == minted_txn_hash
                    {
                        // All conditions are met, proceed to update the deposit status
                        deposit.status = DEP_BTC_MINTED_INTO_ABTC;
                        deposit.timestamp = env::block_timestamp() / 1_000_000_000;
                        self.deposits.insert(btc_txn_hash.clone(), deposit);
                        log!(
                            "Deposit status updated to DEP_BTC_MINTED_INTO_ABTC for btc_txn_hash: {}",
                            btc_txn_hash
                        );
                    } else {
                        // Log a message if conditions are not met
                        log!(
                            "Conditions not met for updating deposit minted status for btc_txn_hash: {}. 
                            Status: {}, Verified count: {}, Remarks: {}, Minted txn hash: {}, Minted txn hash verified count: {}",
                            btc_txn_hash,
                            deposit.status,
                            deposit.verified_count,
                            deposit.remarks,
                            deposit.minted_txn_hash,
                            deposit.minted_txn_hash_verified_count
                        );
                    }
                } else {
                    env::panic_str("Chain configuration not found for receiving chain ID");
                }
            } else {
                env::panic_str("Chain configuration not found for bitcoin deposit");
            }
        } else {
            env::panic_str("Deposit record not found");
        }
    }

    /// Updates the remarks field of a deposit record
    /// @param btc_txn_hash - The Bitcoin transaction hash to update
    /// @param remarks - The remarks to set for the deposit
    /// # Requirements
    /// * Caller must be an admin
    /// * Contract must not be paused
    /// * Deposit must exist
    /// * Deposit status must not be DEP_BTC_MINTED_INTO_ABTC
    /// * Remarks must not be blank
    pub fn update_deposit_remarks(&mut self, btc_txn_hash: String, remarks: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        assert!(!remarks.trim().is_empty(), "Remarks cannot be blank");

        // Retrieve the deposit record based on btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            // Check if the status is not equal to DEP_BTC_MINTED_INTO_ABTC
            if deposit.status != DEP_BTC_MINTED_INTO_ABTC {
                // All conditions are met, proceed to update the remarks
                deposit.remarks = remarks;
                deposit.timestamp = env::block_timestamp() / 1_000_000_000;
                self.deposits.insert(btc_txn_hash.clone(), deposit);
                log!("Remarks updated for btc_txn_hash: {}", btc_txn_hash);
            } else {
                // Log a message if the status condition is not met
                log!("Cannot update remarks for btc_txn_hash: {} as the status is DEP_BTC_MINTED_INTO_ABTC", btc_txn_hash);
            }
        } else {
            env::panic_str("Deposit record not found");
        }
    }

    /// Rolls back the status of a deposit record to a previous state
    /// @param btc_txn_hash - The Bitcoin transaction hash to rollback
    /// # Requirements
    /// * Contract must not be paused
    /// * BTC transaction hash must not be empty
    /// * Deposit must exist with valid sender and receiving addresses
    /// * Deposit must have non-empty remarks
    pub fn rollback_deposit_status_by_btc_txn_hash(&mut self, btc_txn_hash: String) {
        self.assert_not_paused();

        if btc_txn_hash.is_empty() {
            env::panic_str("BTC transaction hash cannot be empty");
        }

        //let global_params = self.get_all_global_params();
        //let global_params_json = serde_json::to_value(&global_params).unwrap();
        //let max_retry_count = global_params_json["max_retry_count"].as_u64().unwrap() as u8;

        // Retrieve the deposit record based on btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            if !deposit.btc_sender_address.is_empty()
                && !deposit.receiving_chain_id.is_empty()
                && !deposit.receiving_address.is_empty()            
                && !deposit.remarks.is_empty()
            //&& deposit.retry_count < max_retry_count
            {
                // If receiving chain ID is EVM and receiving address is not a valid EVM address, do not rollback
                if let Some(chain_config) = self
                    .chain_configs
                    .get_chain_config(deposit.receiving_chain_id.clone())
                {
                    let path = chain_config.network_type.clone();
                    if path == EVM.to_string() {
                        if !Self::is_valid_eth_address(deposit.receiving_address.clone()) {
                            env::log_str("Receiving address is not a valid EVM address");
                            return;
                        }
                    }
                }

                match deposit.status {
                    DEP_BTC_PENDING_MEMPOOL => {
                        deposit.retry_count += 1;
                        deposit.remarks.clear();
                    }
                    DEP_BTC_DEPOSITED_INTO_ATLAS => {
                        deposit.retry_count += 1;
                        deposit.remarks.clear();
                    }
                    DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT => {
                        deposit.status = DEP_BTC_DEPOSITED_INTO_ATLAS;
                        deposit.retry_count += 1;
                        deposit.remarks.clear();
                    }
                    DEP_BTC_YIELD_PROVIDER_DEPOSITED => {
                        deposit.retry_count += 1;
                        deposit.remarks.clear();
                    }
                    DEP_BTC_PENDING_MINTED_INTO_ABTC => {
                        deposit.status = DEP_BTC_YIELD_PROVIDER_DEPOSITED;
                        deposit.retry_count += 1;
                        deposit.remarks.clear();
                    }
                    _ => {
                        // No action needed for other statuses
                    }
                }
                deposit.timestamp = env::block_timestamp() / 1_000_000_000;
                // Update the deposit record in the map
                self.deposits.insert(btc_txn_hash, deposit);
            }
        } else {
            env::log_str("Deposit record not found for the given BTC txn hash");
        }
    }

    /// Creates a signed transaction for minting aBTC on the target blockchain
    /// @param btc_txn_hash - The Bitcoin transaction hash for the deposit
    /// @param nonce - The transaction nonce for the target chain
    /// @param gas - The gas limit for the transaction
    /// @param max_fee_per_gas - The maximum fee per gas unit
    /// @param max_priority_fee_per_gas - The maximum priority fee per gas unit
    /// @returns PromiseOrValue<String> - A promise for the signed transaction or error message
    /// # Requirements
    /// * Caller must be an admin
    /// * Contract must not be paused
    /// * Deposit must exist and be in yield provider deposited status
    /// * Deposit must have no remarks and no minted transaction hash
    /// * Verified count must meet validator threshold
    /// * Receiving address must be valid for the target chain type
    pub fn create_mint_abtc_signed_tx(
        &mut self,
        btc_txn_hash: String,
        nonce: u64,
        gas: u128,
        max_fee_per_gas: u128,
        max_priority_fee_per_gas: u128,
    ) -> PromiseOrValue<String> {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        assert!(gas != 0, "Gas cannot be zero");

        // Check if the deposit exists for the given btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            if deposit.btc_sender_address != ""
                && deposit.receiving_chain_id != ""
                && deposit.receiving_address != ""
                && deposit.status == DEP_BTC_YIELD_PROVIDER_DEPOSITED
                && deposit.remarks == ""
                && deposit.minted_txn_hash == ""
            // This will stop re-minting as no one can update this once minted
            {
                // Get the chain config using the deposit's receiving_chain_id
                if let Some(chain_config) = self
                    .chain_configs
                    .get_chain_config(deposit.receiving_chain_id.clone())
                {
                    // Ensure the deposit's verified_count meets or exceeds the chain's validators_threshold
                    if deposit.verified_count >= chain_config.validators_threshold {
                        log!(
                            "Deposit's verified_count ({}) meets or exceeds the validators_threshold ({})",
                            deposit.verified_count,
                            chain_config.validators_threshold
                        );

                        // Get the "path" dynamically from the chain config (e.g., "EVM", "NEAR")
                        let path = chain_config.network_type.clone(); // Assuming network_type represents the path
                        let current_timestamp = env::block_timestamp() / 1_000_000_000;

                        log!("Found chain config for chain_id: {}", path);

                        deposit.status = DEP_BTC_PENDING_MINTED_INTO_ABTC;
                        deposit.timestamp = current_timestamp;

                        // Update the deposit in the map
                        self.deposits.insert(btc_txn_hash.clone(), deposit.clone());

                        if path == EVM.to_string() {
                            // Check if the receiving address is a valid EVM address
                            if !Self::is_valid_eth_address(deposit.receiving_address.clone()) {
                                // Set remarks if the address is not a valid EVM address
                                let error_msg =
                                    "Receiving address is not a valid EVM address".to_string();

                                deposit.remarks = error_msg.clone();

                                // Update the deposit in the map
                                self.deposits.insert(btc_txn_hash.clone(), deposit.clone());

                                // Panic with the error message
                                env::panic_str(&error_msg);
                            }

                            // Ensure the BTC amount is properly converted to U256 (Ethereum uint256)
                            let amount = U256::from(deposit.btc_amount);
                            let yield_provider_gas_fee = U256::from(deposit.yield_provider_gas_fee);
                            let minting_fee = U256::from(deposit.minting_fee);
                            let protocol_fee = U256::from(deposit.protocol_fee);

                            let to_address_str =
                                chain_config.abtc_address.strip_prefix("0x").unwrap();
                            let to_address = parse_eth_address(to_address_str);
                            let destination = H160::from_slice(
                                &hex::decode(deposit.receiving_address.strip_prefix("0x").unwrap())
                                    .expect("Invalid hex address"),
                            );
                            let value_as_128 = 0;

                            let data: Vec<u8> = Self::encode_mint_function_call(
                                destination,
                                amount - yield_provider_gas_fee - minting_fee - protocol_fee,
                                btc_txn_hash.clone(),
                            );

                            let evm_tx = OmniTransactionBuilder::new::<EVM>()
                                .nonce(nonce)
                                .to(to_address)
                                .value(value_as_128)
                                .input(data.clone())
                                .max_priority_fee_per_gas(max_priority_fee_per_gas)
                                .max_fee_per_gas(max_fee_per_gas)
                                .gas_limit(gas)
                                .chain_id(
                                    deposit
                                        .receiving_chain_id
                                        .clone()
                                        .parse::<u64>()
                                        .unwrap_or_else(|_| {
                                            // Handle the error case, e.g., log an error and provide a default value
                                            env::panic_str("Invalid chain ID format.");
                                        }),
                                )
                                .build();

                            let evm_tx_encoded = evm_tx.build_for_signing();

                            let evm_tx_hash = keccak256(&evm_tx_encoded);

                            log!("Payload: [{}] {:?}", evm_tx_hash.len(), evm_tx_hash);

                            // Call MPC
                            return PromiseOrValue::Promise(
                                ext_signer::ext(self.global_params.get_mpc_contract())
                                    .with_attached_deposit(NearToken::from_millinear(500))
                                    .sign(SignRequest::new(
                                        evm_tx_hash.try_into().unwrap_or_else(|e| {
                                            panic!("Failed to convert payload {:?}", e)
                                        }),
                                        path,
                                        0,
                                    ))
                                    .then(
                                        Self::ext(env::current_account_id())
                                            .with_static_gas(SIGN_CALLBACK_GAS)
                                            .with_unused_gas_weight(0)
                                            .sign_callback(evm_tx),
                                    ),
                            );
                        } else if path == NEAR.to_string() {
                            log!(
                                "Minting aBTC on NEAR chain for deposit with btc_txn_hash: {}",
                                btc_txn_hash
                            );

                            let amount_to_mint = (deposit.btc_amount
                                - deposit.protocol_fee
                                - deposit.yield_provider_gas_fee
                                - deposit.minting_fee)
                                .to_string();
                            let account_id_str = chain_config.abtc_address.clone().to_string();
                            let account_id = AccountId::from_str(&account_id_str)
                                .expect("Invalid NEAR account ID");

                            log!("deposit.receiving_address: {}", deposit.receiving_address);
                            log!("amount: {}", amount_to_mint.to_string());
                            log!("btc_txn_hash: {}", btc_txn_hash);

                            let args_json_string = json!({
                                "account_id": deposit.receiving_address,
                                "amount": amount_to_mint,
                                "btc_txn_hash": btc_txn_hash
                            })
                            .to_string();

                            log!("Serialized JSON args: {}", args_json_string);

                            let args = args_json_string.into_bytes();

                            // Check if the account has enough storage
                            let storage_check_args = json!({
                                "account_id": deposit.receiving_address
                            })
                            .to_string()
                            .into_bytes();

                            let storage_deposit_promise = Promise::new(account_id.clone())
                                .function_call(
                                    "storage_deposit".to_string(),
                                    storage_check_args.clone(),
                                    MIN_STORAGE_DEPOSIT,
                                    GAS_FOR_STORAGE_DEPOSIT,
                                );

                            let mint_promise = Promise::new(account_id.clone()).function_call(
                                "mint_deposit".to_string(),   // The mint function to call
                                args,                         // The arguments for minting
                                NearToken::from_yoctonear(0), // Attach a small amount of NEAR (if required)
                                GAS_FOR_MINT_CALL,            // Gas to attach to this call
                                                              //Gas::from_tgas(gas.try_into().unwrap()),            // Gas to attach to this call
                            );

                            // Chain the storage deposit and mint promises
                            return PromiseOrValue::Promise(
                                storage_deposit_promise.then(mint_promise),
                            );
                        }
                    } else {
                        log!(
                            "Deposit's verified_count ({}) is less than validators_threshold ({})",
                            deposit.verified_count,
                            chain_config.validators_threshold
                        );
                        return PromiseOrValue::Value("Validators threshold not met.".to_string());
                    }
                } else {
                    log!(
                        "Chain config not found for chain_id: {}",
                        deposit.receiving_chain_id
                    );
                    return PromiseOrValue::Value("Chain config not found.".to_string());
                }
            }
        }

        PromiseOrValue::Value("Deposit not found or invalid conditions.".to_string())
    }

    /// Callback function for handling the result of transaction signing
    /// @param evm_tx - The EVM transaction to be signed
    /// @param result - The result of the signing operation
    /// @returns Vec<u8> - The signed transaction bytes
    #[private]
    pub fn sign_callback(
        &self,
        evm_tx: EVMTransaction,
        #[callback_result] result: Result<SignResult, PromiseError>,
    ) -> Vec<u8> {
        if let Ok(sign_result) = result {
            let big_r = &sign_result.big_r.affine_point;
            let s = &sign_result.s.scalar;
            let recovery_id = &sign_result.recovery_id;

            let v: u64 = *recovery_id as u64;

            let r = &big_r[2..];
            let end = &big_r[..2];

            let r_bytes = Vec::from_hex(r).expect("Invalid hex in r");
            let s_bytes = Vec::from_hex(s).expect("Invalid hex in s");
            let _end_bytes = Vec::from_hex(end).expect("Invalid hex in end");

            let signature_omni: OmniSignature = OmniSignature {
                v: v,
                r: r_bytes.to_vec(),
                s: s_bytes.to_vec(),
            };
            // Now you can use `evm_tx` and build the transaction with signature
            let near_tx_signed = evm_tx.build_with_signature(&signature_omni);

            log!("EVM_SIGNED_TRANSACTION: {}", hex::encode(&near_tx_signed));

            // Return the signed transaction here
            return near_tx_signed;
        } else {
            panic!("Callback failed");
        }
    }

    /// Helper function to encode the mint function call for EVM transactions
    /// @param to_address - The destination address for the mint
    /// @param amount - The amount to mint
    /// @param btc_txn_hash - The Bitcoin transaction hash
    /// @returns Vec<u8> - The encoded function call data
    fn encode_mint_function_call(to_address: H160, amount: U256, btc_txn_hash: String) -> Vec<u8> {
        let mint_function_signature = "mintDeposit(address,uint256,string)"; // Updated Solidity function signature

        // Compute the Keccak-256 hash of the function signature and take the first 4 bytes
        let function_selector = &keccak256(mint_function_signature.as_bytes())[0..4];

        // Encode the function call with the address, amount, and BTC transaction hash
        let mut encoded = ethabi::encode(&[
            ethabi::Token::Address(to_address),  // Address as 20 bytes (H160)
            ethabi::Token::Uint(amount),         // Uint256 as 32 bytes (U256)
            ethabi::Token::String(btc_txn_hash), // String (BTC transaction hash)
        ]);

        // Prepend the function selector to the encoded parameters
        let mut function_call_data = Vec::with_capacity(function_selector.len() + encoded.len());
        function_call_data.extend_from_slice(function_selector); // Add the function selector
        function_call_data.append(&mut encoded); // Add the encoded parameters

        function_call_data
    }

    /// Creates a signed payload for BitHive deposit operations
    /// @param payload - The payload to be signed
    /// @returns Promise - A promise for the signed payload
    /// # Requirements
    /// * Caller must be an admin
    pub fn create_deposit_bithive_signed_payload(
        &mut self,
        payload: Vec<u8>, // Passing the payload
    ) -> Promise {
        self.assert_admin();

        let caller = env::predecessor_account_id();
        let owner = env::current_account_id();

        log!("Caller: {}", caller);
        log!("Owner: {}", owner);

        let args = json!({
            "request": {
                "payload": payload,
                "path": "BITCOIN",
                "key_version": 0
            }
        })
        .to_string()
        .into_bytes();

        // Return the promise for the first matching record
        return Promise::new(self.global_params.get_mpc_contract()).function_call(
            "sign".to_owned(),
            args,
            NearToken::from_yoctonear(50),
            Gas::from_tgas(275),
        );
    }

    /// Increments the verified count for a deposit record
    /// @param mempool_deposit - The mempool deposit record to verify
    /// @returns bool - True if verification was successful, false otherwise
    /// # Requirements
    /// * Contract must not be paused
    /// * Caller must be an authorized validator for the bitcoin chain
    /// * Caller must not have already verified this transaction
    /// * All fields of mempool_deposit must match the existing deposit record
    /// * Deposit must be in DEP_BTC_DEPOSITED_INTO_ATLAS status
    pub fn increment_deposit_verified_count(&mut self, mempool_deposit: DepositRecord) -> bool {
        self.assert_not_paused();

        let caller: AccountId = env::predecessor_account_id();

        // Validate the mempool_deposit
        if mempool_deposit.btc_txn_hash.is_empty() {
            log!("Invalid mempool_deposit: btc_txn_hash is empty");
            return false;
        }

        // Retrieve the deposit record using the btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&mempool_deposit.btc_txn_hash).cloned() {
            let chain_id = if self.is_production_mode() {
                BITCOIN.to_string()
            } else {
                TESTNET4.to_string()
            };

            // Use the is_validator function to check if the caller is authorized for the bitcoin deposit
            if self.is_validator(&caller, &chain_id) {
                // Retrieve the list of validators for this btc_txn_hash using the getter method
                let mut validators_list =
                    self.get_validators_by_txn_hash(deposit.btc_txn_hash.clone());

                // Check if the caller has already verified this btc_txn_hash
                if validators_list.contains(&caller) {
                    log!(
                        "Caller {} has already verified the transaction with btc_txn_hash: {}.",
                        &caller,
                        &deposit.btc_txn_hash
                    );
                    return false;
                }

                // Verify that all fields of deposit and mempool_deposit are equal
                if deposit.btc_txn_hash != mempool_deposit.btc_txn_hash
                    || deposit.btc_sender_address != mempool_deposit.btc_sender_address
                    || deposit.receiving_chain_id != mempool_deposit.receiving_chain_id
                    || deposit.receiving_address != mempool_deposit.receiving_address
                    || deposit.btc_amount != mempool_deposit.btc_amount
                    || deposit.protocol_fee != mempool_deposit.protocol_fee
                    //|| deposit.timestamp != mempool_deposit.timestamp         /* deposit.timestamp is being updated upon any status change */
                    || deposit.status != DEP_BTC_DEPOSITED_INTO_ATLAS
                    || deposit.remarks != mempool_deposit.remarks
                {
                    log!("Mismatch between near_deposit and mempool_deposit records. Verification failed.");
                    return false;
                }

                // Increment the verified count
                deposit.verified_count += 1;
                deposit.timestamp = env::block_timestamp() / 1_000_000_000;
                // Clone deposit before inserting it to avoid moving it
                let cloned_deposit = deposit.clone();

                // Update the deposit record in the map
                self.deposits
                    .insert(mempool_deposit.btc_txn_hash.clone(), cloned_deposit);

                // Add the caller to the list of validators for this btc_txn_hash
                validators_list.push(caller);
                self.verifications
                    .insert(mempool_deposit.btc_txn_hash.clone(), validators_list);

                true // success case returns true
            } else {
                log!(
                    "Caller {} is not an authorized validator for the chain ID: {}",
                    &caller,
                    &chain_id
                );
                return false;
            }
        } else {
            log!(
                "Deposit record not found for btc_txn_hash: {}.",
                &mempool_deposit.btc_txn_hash
            );
            return false;
        }
    }

    /// Updates the yield provider transaction hash for a deposit
    /// @param btc_txn_hash - The Bitcoin transaction hash to update
    /// @param yield_provider_txn_hash - The yield provider transaction hash
    /// # Requirements
    /// * Caller must be an admin
    /// * Contract must not be paused
    /// * Deposit must be in DEP_BTC_DEPOSITED_INTO_ATLAS status
    /// * Deposit must have no existing yield provider transaction hash
    /// * Deposit must have no remarks
    pub fn update_yield_provider_txn_hash(
        &mut self,
        btc_txn_hash: String,
        yield_provider_txn_hash: String,
    ) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        assert!(
            !yield_provider_txn_hash.is_empty(),
            "Yield provider transaction hash cannot be empty"
        );

        // Check if the deposit exists for the given btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            // Update the yield_provider_txn_hash
            if deposit.status == DEP_BTC_DEPOSITED_INTO_ATLAS
                && deposit.yield_provider_txn_hash == ""
                && deposit.remarks == ""
            {
                deposit.status = DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT;
                deposit.yield_provider_txn_hash = yield_provider_txn_hash;
                self.deposits.insert(btc_txn_hash.clone(), deposit);
                log!(
                    "Yield provider transaction hash updated for btc_txn_hash: {}",
                    btc_txn_hash
                );
            } else {
                env::panic_str("Deposit record not in valid conditions");
            }
        } else {
            env::panic_str("Deposit record not found");
        }
    }

    /// Increments the minted transaction hash verified count for a deposit
    /// @param btc_txn_hash - The Bitcoin transaction hash
    /// @param minted_txn_hash - The minted transaction hash to verify
    /// @returns bool - True if verification was successful, false otherwise
    /// # Requirements
    /// * Contract must not be paused
    /// * Caller must be an authorized validator for the receiving chain
    /// * Caller must not have already verified this transaction
    /// * Deposit record's btc_txn_hash and minted_txn_hash must match input parameters
    pub fn increment_deposit_minted_txn_hash_verified_count(
        &mut self,
        btc_txn_hash: String,
        minted_txn_hash: String,
    ) -> bool {
        self.assert_not_paused();

        // Validate input parameters
        if btc_txn_hash.is_empty() || minted_txn_hash.is_empty() {
            log!("Invalid input: btc_txn_hash or minted_txn_hash is empty");
            return false;
        }

        let caller: AccountId = env::predecessor_account_id();

        // Retrieve the deposit record using the btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            // Check if the caller is an authorized validator for the receiving_chain_id
            if self.is_validator(&caller, &deposit.receiving_chain_id) {
                // Create a unique key for the verifications map using the COMMA constant
                let verification_key = format!("{}{}{}", btc_txn_hash, COMMA, minted_txn_hash);

                // Retrieve the list of validators for this <btc_txn_hash>,<minted_txn_hash>
                let mut validators_list = self.get_validators_by_txn_hash(verification_key.clone());

                // Check if the caller has already verified this <btc_txn_hash>,<minted_txn_hash>
                if validators_list.contains(&caller) {
                    log!(
                        "Caller {} has already verified the transaction with btc_txn_hash: {} and minted_txn_hash: {}.",
                        &caller,
                        &btc_txn_hash,
                        &minted_txn_hash
                    );
                    return false;
                }

                // Verify that the deposit record's btc_txn_hash and minted_txn_hash match the input parameters
                if deposit.btc_txn_hash == btc_txn_hash
                    && deposit.minted_txn_hash == minted_txn_hash
                {
                    // Increment the minted_txn_hash_verified_count
                    deposit.minted_txn_hash_verified_count += 1;
                    deposit.timestamp = env::block_timestamp() / 1_000_000_000;
                    // Update the deposit record in the map
                    self.deposits.insert(btc_txn_hash.clone(), deposit);

                    // Add the caller to the list of validators for this <btc_txn_hash>,<minted_txn_hash>
                    validators_list.push(caller);
                    self.verifications.insert(verification_key, validators_list);

                    true // success case returns true
                } else {
                    log!("Mismatch between deposit record and input parameters. Verification failed.");
                    false
                }
            } else {
                log!(
                    "Caller {} is not an authorized validator for the receiving_chain_id: {}",
                    &caller,
                    &deposit.receiving_chain_id
                );
                false
            }
        } else {
            log!(
                "Deposit record not found for btc_txn_hash: {}.",
                &btc_txn_hash
            );
            false
        }
    }

    pub fn withdraw_fail_deposit_by_btc_tx_hash(
        &mut self,
        btc_txn_hash: String,
        utxos: Vec<UtxoInput>,
        fee_rate: u64,
    ) -> WithDrawFailDepositResult {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );

        let global_params = self.get_all_global_params();
        let global_params_json = serde_json::to_value(&global_params).unwrap();
        let max_retry_count = global_params_json["max_retry_count"].as_u64().unwrap() as u8;

        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            if (deposit.status == DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT
                || deposit.status == DEP_BTC_DEPOSITED_INTO_ATLAS)
                && !deposit.remarks.is_empty()
                && deposit.retry_count >= max_retry_count
            {
                deposit.status = DEP_BTC_REFUNDING;
                self.deposits.insert(btc_txn_hash, deposit.clone());

                let mut total_input = 0u64;
                let mut selected_utxos: Vec<UtxoInput> = Vec::new();
                let mut estimated_fee = 0u64;
                let satoshis = deposit.btc_amount; // Amount in satoshis

                // Sort UTXOs by value (ascending order)
                let mut sorted_utxos = utxos.clone();
                sorted_utxos.sort_by(|a, b| a.value.cmp(&b.value));

                // Select UTXOs until the total input covers satoshis + estimated fee + redemption fee
                for utxo in sorted_utxos.iter() {
                    selected_utxos.push(utxo.clone());
                    total_input += utxo.value;

                    let estimated_size = selected_utxos.len() * 148 + 34 + 100; // Estimated size in bytes
                    estimated_fee = fee_rate * estimated_size as u64;

                    let required_amount = satoshis + estimated_fee;

                    if total_input >= required_amount {
                        break;
                    }
                }

                if total_input < satoshis {
                    env::panic_str(&format!(
                        "Not enough UTXOs to cover the transaction. Total input: {}, Required: {}",
                        total_input, satoshis
                    ));
                }

                // Prepare the outputs for the transaction
                let receive_amount = satoshis - estimated_fee;
                let change = total_input - satoshis;

                // Create a new raw unsigned transaction
                let mut unsigned_tx = Transaction {
                    version: 2,     // Current standard version of Bitcoin transactions
                    lock_time: 0,   // No specific lock time
                    input: vec![],  // To be populated below
                    output: vec![], // To be populated below
                };

                // Add outputs to the raw unsigned transaction
                unsigned_tx.output.push(TxOut {
                    value: receive_amount,
                    script_pubkey: Address::from_str(&deposit.btc_sender_address)
                        .unwrap()
                        .script_pubkey(), // Receiver's scriptPubKey
                });

                // Add change output, if applicable
                if change > 0 {
                    unsigned_tx.output.push(TxOut {
                        value: change,
                        script_pubkey: Address::from_str(&deposit.btc_sender_address)
                            .unwrap()
                            .script_pubkey(), // Sender's scriptPubKey for change
                    });
                }

                // Add OP_RETURN for transaction metadata
                unsigned_tx.output.push(TxOut {
                    value: 0,
                    script_pubkey: bitcoin::blockdata::script::Builder::new()
                        .push_opcode(bitcoin::blockdata::opcodes::all::OP_RETURN)
                        .push_slice(deposit.btc_txn_hash.as_bytes()) // Store the txn_hash in OP_RETURN
                        .into_script(),
                });

                // Create a PSBT from the unsigned transaction
                let psbt = Psbt::from_unsigned_tx(unsigned_tx).expect("Failed to create PSBT");

                // Serialize the PSBT to bytes
                let serialized_psbt = serialize(&psbt);

                // Return the results as the custom struct
                return WithDrawFailDepositResult {
                    btc_txn_hash: deposit.btc_txn_hash.clone(), // Return the BTC transaction hash
                    psbt: base64::encode(&serialized_psbt), // Return the PSBT as base64-encoded binary
                    utxos: selected_utxos,                  // Return the selected UTXOs
                    estimated_fee,                          // Return the estimated fee
                    receive_amount,                         // Return the amount the receiver gets
                    change,                                 // Return the change amount
                };
            } else {
                env::panic_str("Deposit is not in invalid conditions.")
            }
        }

        env::panic_str("Deposit is not found.")
    }

    pub fn update_withdraw_fail_deposit_status(&mut self, btc_txn_hash: String, timestamp: u64) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        assert!(timestamp > 0, "Timestamp must be greater than zero");

        // Retrieve the redemption record based on txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash.clone()).cloned() {
            if deposit.status == DEP_BTC_REFUNDING && !deposit.refund_txn_id.is_empty() {
                deposit.status = DEP_BTC_REFUNDED;
                self.deposits.insert(btc_txn_hash.clone(), deposit);
            } else {
                env::panic_str("Deposit is not in invalid conditions.");
            }
        } else {
            env::panic_str("Deposit is not found.");
        }
    }

    pub fn update_deposit_refund_txn_id(&mut self, btc_txn_hash: String, refund_txn_id: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!btc_txn_hash.is_empty(), "Transaction hash cannot be empty");
        assert!(
            !refund_txn_id.is_empty(),
            "Custody transaction ID cannot be empty"
        );

        // Retrieve the redemption record based on txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash.clone()).cloned() {
            if deposit.status == DEP_BTC_REFUNDING && deposit.refund_txn_id.is_empty() {
                deposit.refund_txn_id = refund_txn_id.clone();
                self.deposits.insert(btc_txn_hash.clone(), deposit);
            } else {
                env::panic_str("Deposit is not in invalid conditions.");
            }
        } else {
            env::panic_str("Deposit record not found");
        }
    }

    /// Updates specific fields of a deposit record identified by its txn_hash
    pub fn update_deposit(
        &mut self,
        txn_hash: String,
        status: u8,
        remarks: String,
        retry_count: u8,
        verified_count: u8,
        refund_txn_id: String,
    ) {
        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");

        // Retrieve the deposit record based on txn_hash
        if let Some(mut deposit) = self.deposits.get(&txn_hash).cloned() {
            deposit.status = status;
            deposit.remarks = remarks;
            deposit.retry_count = retry_count;
            deposit.verified_count = verified_count;
            deposit.refund_txn_id = refund_txn_id;

            // Update the deposit record in the map
            self.deposits.insert(txn_hash.clone(), deposit);

            log!("Deposit updated successfully for txn_hash: {}", txn_hash);
        } else {
            env::panic_str("Deposit record not found");
        }
    }
}
