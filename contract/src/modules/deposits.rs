use crate::atlas::Atlas;
use crate::chain_configs::ChainConfigRecord;
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
    env, log, near_bindgen, AccountId, NearToken, Promise, PromiseError, PromiseOrValue,
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
    pub fn insert_deposit_btc(
        &mut self,
        btc_txn_hash: String,
        btc_sender_address: String,
        receiving_chain_id: String,
        receiving_address: String,
        btc_amount: u64,
        fee_amount: u64,
        minted_txn_hash: String,
        timestamp: u64,
        remarks: String,
        date_created: u64,
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

        // Check for duplicate transaction hash
        if self.deposits.contains_key(&btc_txn_hash) {
            env::panic_str("Deposit with this transaction hash already exists");
        }

        // let global_params = self.get_all_global_params();
        // let global_params_json = serde_json::to_value(&global_params).unwrap();
        // let fee_deposit_bps = global_params_json["fee_deposit_bps"].as_u64().unwrap() as u16;
        // let fee_amount: u64 = (fee_deposit_bps as u64 * btc_amount) / 10000;

        let record = DepositRecord {
            btc_txn_hash: btc_txn_hash.clone(),
            btc_sender_address,
            receiving_chain_id,
            receiving_address,
            btc_amount,
            fee_amount,
            minted_txn_hash,
            timestamp,
            status: DEP_BTC_PENDING_MEMPOOL,
            remarks,
            date_created,
            verified_count: 0,
            retry_count: 0,
            minted_txn_hash_verified_count: 0,
            custody_txn_id: "".to_string(),
        };

        self.deposits.insert(btc_txn_hash, record);
    }

    pub fn get_deposit_by_btc_txn_hash(&self, btc_txn_hash: String) -> Option<DepositRecord> {
        // Validate that the btc_txn_hash is not empty
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );

        self.deposits.get(&btc_txn_hash).cloned()
    }

    pub fn get_deposits_by_timestamp(&self, start_time: u64, end_time: u64) -> Vec<DepositRecord> {
        // Validate input parameters
        assert!(start_time > 0, "Start time must be greater than zero");
        assert!(end_time > 0, "End time must be greater than zero");
        assert!(
            start_time <= end_time,
            "Start time must be less than or equal to end time"
        );

        self.deposits
            .values()
            .filter(|record| record.timestamp >= start_time && record.timestamp <= end_time)
            .cloned()
            .collect()
    }

    pub fn get_all_deposits(&self) -> Vec<DepositRecord> {
        self.deposits.values().cloned().collect()
    }

    pub fn get_deposits_count(&self) -> u64 {
        self.deposits.len() as u64
    }

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
                SIGNET.to_string()
            };

            if let Some(chain_config) = self.chain_configs.get_chain_config(chain_id.clone()) {
                // Check all specified conditions
                if (deposit.status == DEP_BTC_PENDING_MINTED_INTO_ABTC)
                    && deposit.verified_count >= chain_config.validators_threshold
                    && deposit.remarks.is_empty()
                    && deposit.minted_txn_hash.is_empty()
                {
                    // All conditions are met, proceed to update the minted transaction hash
                    deposit.minted_txn_hash = minted_txn_hash.clone();
                    self.deposits.insert(btc_txn_hash.clone(), deposit);
                    log!(
                        "minted txn hash: {} updated for btc_txn_hash: {}",
                        minted_txn_hash,
                        btc_txn_hash
                    );
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
                SIGNET.to_string()
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

    pub fn get_first_valid_deposit_chain_config(&self) -> Option<(String, ChainConfigRecord)> {
        for (key, deposit) in self.deposits.iter() {
            if deposit.btc_sender_address != ""
                && deposit.receiving_chain_id != ""
                && deposit.receiving_address != ""
                && deposit.status == DEP_BTC_DEPOSITED_INTO_ATLAS
                && deposit.remarks == ""
                && deposit.minted_txn_hash == ""
                && deposit.btc_amount > 0  // Add btc amount check
                && deposit.date_created > 0
            // Add date created check
            // This will stop re-minting as no one can update this once minted
            {
                // Get the chain config using deposit.receiving_chain_id
                if let Some(chain_config) = self
                    .chain_configs
                    .get_chain_config(deposit.receiving_chain_id.clone())
                {
                    // Check if the verified_count meets or exceeds the validators_threshold
                    if deposit.verified_count >= chain_config.validators_threshold {
                        log!(
                            "Deposit's verified_count ({}) meets or exceeds the validators_threshold ({})",
                            deposit.verified_count,
                            chain_config.validators_threshold
                        );
                        return Some((key.clone(), chain_config)); // Return the key and the ChainConfigRecord as a tuple
                    }
                }
            }
        }

        None // If no matching deposit or chain config is found, return None
    }

    pub fn rollback_all_deposit_status(&mut self) {
        self.assert_not_paused();

        let global_params = self.get_all_global_params();
        let global_params_json = serde_json::to_value(&global_params).unwrap();
        let max_retry_count = global_params_json["max_retry_count"].as_u64().unwrap() as u8;

        // Collect the keys and deposits that need to be updated
        let updates: Vec<(String, DepositRecord)> = self
            .deposits
            .iter()
            .filter_map(|(key, deposit)| {
                let mut deposit = deposit.clone(); // Clone the deposit to modify it
                if !deposit.btc_sender_address.is_empty()
                    && !deposit.receiving_chain_id.is_empty()
                    && !deposit.receiving_address.is_empty()
                    && !deposit.remarks.is_empty()
                    && deposit.retry_count < max_retry_count
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
                                return None;
                            }
                        }
                    }

                    match deposit.status {
                        DEP_BTC_PENDING_DEPOSIT_INTO_BABYLON => {
                            deposit.status = DEP_BTC_DEPOSITED_INTO_ATLAS;
                            deposit.retry_count += 1;
                            deposit.remarks.clear();
                            Some((key.clone(), deposit)) // Clone the key and return the updated deposit
                        }
                        DEP_BTC_PENDING_MINTED_INTO_ABTC => {
                            deposit.status = DEP_BTC_DEPOSITED_INTO_ATLAS;
                            deposit.retry_count += 1;
                            deposit.remarks.clear();
                            Some((key.clone(), deposit)) // Clone the key and return the updated deposit
                        }
                        _ => None,
                    }
                } else {
                    None
                }
            })
            .collect();

        // Apply the updates
        for (key, deposit) in updates {
            self.deposits.insert(key, deposit);
        }
    }

    // to create functions to rollback status for records with error messages
    pub fn rollback_deposit_status_by_btc_txn_hash(&mut self, btc_txn_hash: String) {
        self.assert_not_paused();

        if btc_txn_hash.is_empty() {
            env::panic_str("BTC transaction hash cannot be empty");
        }

        let global_params = self.get_all_global_params();
        let global_params_json = serde_json::to_value(&global_params).unwrap();
        let max_retry_count = global_params_json["max_retry_count"].as_u64().unwrap() as u8;

        // Retrieve the deposit record based on btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            if !deposit.btc_sender_address.is_empty()
                && !deposit.receiving_chain_id.is_empty()
                && !deposit.receiving_address.is_empty()
                && !deposit.remarks.is_empty()
                && deposit.retry_count < max_retry_count
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
                    DEP_BTC_PENDING_DEPOSIT_INTO_BABYLON => {
                        deposit.status = DEP_BTC_DEPOSITED_INTO_ATLAS;
                        deposit.retry_count += 1;
                        deposit.remarks.clear();
                    }
                    DEP_BTC_PENDING_MINTED_INTO_ABTC => {
                        deposit.status = DEP_BTC_DEPOSITED_INTO_ATLAS;
                        deposit.retry_count += 1;
                        deposit.remarks.clear();
                    }
                    _ => {
                        // No action needed for other statuses
                    }
                }

                // Update the deposit record in the map
                self.deposits.insert(btc_txn_hash, deposit);
            }
        } else {
            env::log_str("Deposit record not found for the given BTC txn hash");
        }
    }

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
                && deposit.status == DEP_BTC_DEPOSITED_INTO_ATLAS
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
                            // Ensure the BTC amount is properly converted to U256 (Ethereum uint256)
                            let amount = U256::from(deposit.btc_amount);

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
                                amount,
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

                            // Serialize the transaction to JSON or to bytes
                            let evm_tx_json = serde_json::to_string(&evm_tx)
                                .expect("Failed to serialize transaction");

                            // Store the serialized JSON in self.last_evm_tx (as a string or Vec<u8>)
                            self.last_evm_tx = Some(evm_tx_json.into_bytes());

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
                                            .sign_callback(),
                                    ),
                            );
                        } else if path == NEAR.to_string() {
                            log!(
                                "Minting aBTC on NEAR chain for deposit with btc_txn_hash: {}",
                                btc_txn_hash
                            );

                            let amount_to_mint = deposit.btc_amount.to_string();
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

    #[private]
    pub fn sign_callback(
        &self,
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

            // Retrieve the stored last evm transaction
            if let Some(last_evm_tx) = &self.last_evm_tx {
                // Deserialize the JSON string back into EVMTransaction
                let evm_tx: EVMTransaction = serde_json::from_slice(last_evm_tx)
                    .expect("Failed to deserialize last EVM transaction");

                // Now you can use `evm_tx` and build the transaction with signature
                let near_tx_signed = evm_tx.build_with_signature(&signature_omni);

                // Return the signed transaction here
                return near_tx_signed;
            } else {
                panic!("No last evm transaction found");
            }
        } else {
            panic!("Callback failed");
        }
    }

    // Helper function to encode the mint function call
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

    // Increments deposit record's verified_count by 1 based on the mempool_deposit record passed in
    // Caller of this function has to be an authorised validator for the particular chain_id of the deposit record (BITCOIN or SIGNET depending on production mode)
    // Caller of this function has to be a new validator of this btc_txn_hash
    // Checks all fields of mempool_record equal to deposit record
    // Returns true if verified_count incremented successfully and returns false if not incremented
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
                SIGNET.to_string()
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
                    || deposit.fee_amount != mempool_deposit.fee_amount
                    || deposit.timestamp != mempool_deposit.timestamp
                    || deposit.status != DEP_BTC_DEPOSITED_INTO_ATLAS
                    || deposit.remarks != mempool_deposit.remarks
                {
                    log!("Mismatch between near_deposit and mempool_deposit records. Verification failed.");
                    return false;
                }

                // Increment the verified count
                deposit.verified_count += 1;

                // Update the deposit record in the map
                self.deposits
                    .insert(mempool_deposit.btc_txn_hash.clone(), deposit);

                // Add the caller to the list of validators for this btc_txn_hash
                validators_list.push(caller);
                self.verifications
                    .insert(mempool_deposit.btc_txn_hash, validators_list);

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

    // Increments deposit record's minted_txn_hash_verified_count by 1
    // Caller of this function has to be an authorised validator for the particular receiving_chain_id of the deposit record
    // Caller of this function has to be a new validator of this <btc_txn_hash>,<minted_txn_hash>
    // Checks that deposit record's btc_txn_hash and minted_txn_hash are equal to the input parameters, then increments the minted_txn_hash_verified_count by 1
    // Returns true if minted_txn_hash_verified_count incremented successfully and returns false if not incremented
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
            if deposit.status == DEP_BTC_PENDING_MINTED_INTO_ABTC
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
                    env::panic_str("Not enough UTXOs to cover the transaction");
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

    pub fn update_deposit_custody_txn_id(&mut self, btc_txn_hash: String, custody_txn_id: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!btc_txn_hash.is_empty(), "Transaction hash cannot be empty");
        assert!(
            !custody_txn_id.is_empty(),
            "Custody transaction ID cannot be empty"
        );

        // Retrieve the redemption record based on txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash.clone()).cloned() {
            if deposit.status == DEP_BTC_REFUNDING && deposit.custody_txn_id.is_empty() {
                deposit.custody_txn_id = custody_txn_id.clone();
                self.deposits.insert(btc_txn_hash.clone(), deposit);
            } else {
                env::panic_str("Deposit is not in invalid conditions.");
            }
        } else {
            env::panic_str("Deposit record not found");
        }
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
            if deposit.status == DEP_BTC_REFUNDING && !deposit.custody_txn_id.is_empty() {
                deposit.status = DEP_BTC_REFUNDED;
                self.deposits.insert(btc_txn_hash.clone(), deposit);
            } else {
                env::panic_str("Deposit is not in invalid conditions.");
            }
        } else {
            env::panic_str("Deposit is not found.");
        }
    }
}
