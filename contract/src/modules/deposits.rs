use crate::atlas::Atlas;
use crate::chain_configs::ChainConfigRecord;
use crate::constants::near_gas::*;
use crate::constants::network_type::SIGNET;
use crate::constants::status::*;
use crate::modules::signer::*;
use crate::modules::structs::DepositRecord;
use crate::AtlasExt;
use ethers_core::types::{H160, U256};
use hex::FromHex;
use near_sdk::{
    env, log, near_bindgen, AccountId, NearToken, Promise, PromiseError, PromiseOrValue, Gas
};
use omni_transaction::evm::evm_transaction::EVMTransaction;
use omni_transaction::evm::types::Signature as OmniSignature;
use omni_transaction::evm::utils::parse_eth_address;
use omni_transaction::transaction_builder::{
    TransactionBuilder as OmniTransactionBuilder, TxBuilder,
};
use omni_transaction::types::EVM;
use std::str::FromStr;

use near_sdk::env::keccak256;
use serde_json::json;

#[near_bindgen]
impl Atlas {
    pub fn insert_deposit_btc(
        &mut self,
        btc_txn_hash: String,
        btc_sender_address: String,
        receiving_chain_id: String,
        receiving_address: String,
        btc_amount: u64,
        minted_txn_hash: String,
        timestamp: u64,
        remarks: String,
        date_created: u64,
        yield_provider_gas_fee: u64
    ) {
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
        assert!(timestamp > 0, "Timestamp must be greater than zero");
        assert!(date_created > 0, "Date created must be greater than zero");
        assert!(yield_provider_gas_fee > 0, "Yield provider gas fee must be greater than zero");
        // Check for duplicate transaction hash
        if self.deposits.contains_key(&btc_txn_hash) {
            env::panic_str("Deposit with this transaction hash already exists");
        }

        let record = DepositRecord {
            btc_txn_hash: btc_txn_hash.clone(),
            btc_sender_address,
            receiving_chain_id,
            receiving_address,
            btc_amount,
            minted_txn_hash,
            timestamp,
            status: DEP_BTC_PENDING_MEMPOOL,
            remarks,
            date_created,
            verified_count: 0,
            yield_provider_gas_fee,
            yield_provider_txn_hash: "".to_string(),
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

    pub fn update_deposit_pending_yield_provider_deposit(&mut self, btc_txn_hash: String) {
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );

        // Check if the deposit exists for the given btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            // Check all specified conditions
            if deposit.status == DEP_BTC_DEPOSITED_INTO_ATLAS
                && deposit.remarks.is_empty()
                && deposit.minted_txn_hash.is_empty()
            {
                // All conditions are met, proceed to update the deposit status
                deposit.status = DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT;
                deposit.timestamp = env::block_timestamp() / 1_000_000_000;
                self.deposits.insert(btc_txn_hash.clone(), deposit);
                log!(
                    "Deposit status updated to DEP_BTC_PENDING_YIELD_DEPOSIT for btc_txn_hash: {}",
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

    pub fn update_deposit_yield_provider_deposited(&mut self, btc_txn_hash: String) {
        self.assert_admin();

        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        
        // Check if the deposit exists for the given btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            // Check all specified conditions
            if deposit.status == DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT
                && deposit.remarks.is_empty()
                && deposit.minted_txn_hash.is_empty()
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

    pub fn update_deposit_minted(&mut self, btc_txn_hash: String, minted_txn_hash: String) {
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
            // Fetch chain configuration for the deposit's receiving_chain_id
            if let Some(chain_config) = self
                .chain_configs
                .get_chain_config(deposit.receiving_chain_id.clone())
            {
                // Check all specified conditions
                if (deposit.status == DEP_BTC_PENDING_MINTED_INTO_ABTC
                    || deposit.status == DEP_BTC_DEPOSITED_INTO_ATLAS)
                    && deposit.verified_count >= chain_config.validators_threshold
                    && deposit.remarks.is_empty()
                    && deposit.minted_txn_hash.is_empty()
                {
                    // All conditions are met, proceed to update the deposit status and minted transaction hash
                    deposit.status = DEP_BTC_MINTED_INTO_ABTC;
                    deposit.timestamp = env::block_timestamp() / 1_000_000_000;
                    deposit.minted_txn_hash = minted_txn_hash.clone();
                    self.deposits.insert(btc_txn_hash.clone(), deposit);
                    log!(
                        "Deposit status updated to DEP_BTC_MINTED_INTO_ABTC for btc_txn_hash: {}",
                        btc_txn_hash
                    );
                } else {
                    // Log a message if conditions are not met
                    log!(
                        "Conditions not met for updating deposit minted status for btc_txn_hash: {}. 
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

    pub fn update_deposit_remarks(&mut self, btc_txn_hash: String, remarks: String) {
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

    pub fn get_first_valid_user_deposit(&self) -> Option<(String, u64, u64)> {
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
                        return Some((key.clone(), deposit.btc_amount.clone(), deposit.yield_provider_gas_fee.clone())); // Return the key and the ChainConfigRecord as a tuple
                    }
                }
            }
        }

        None // If no matching deposit or chain config is found, return None
    }

    pub fn get_first_valid_deposit_chain_config(&self) -> Option<(String, ChainConfigRecord)> {
        for (key, deposit) in self.deposits.iter() {
            if deposit.btc_sender_address != ""
                && deposit.receiving_chain_id != ""
                && deposit.receiving_address != ""
                && deposit.status == DEP_BTC_YIELD_PROVIDER_DEPOSITED
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
                {
                    match deposit.status {
                        DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT => {
                            deposit.status = DEP_BTC_DEPOSITED_INTO_ATLAS;
                            deposit.remarks.clear();
                            Some((key.clone(), deposit)) // Clone the key and return the updated deposit
                        }
                        DEP_BTC_PENDING_MINTED_INTO_ABTC => {
                            deposit.status = DEP_BTC_DEPOSITED_INTO_ATLAS;
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
        if btc_txn_hash.is_empty() {
            env::panic_str("BTC transaction hash cannot be empty");
        }

        // Retrieve the deposit record based on btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            if !deposit.btc_sender_address.is_empty()
                && !deposit.receiving_chain_id.is_empty()
                && !deposit.receiving_address.is_empty()
                //&& !deposit.remarks.is_empty()
            {
                match deposit.status {
                    DEP_BTC_YIELD_PROVIDER_DEPOSITED => {
                        deposit.status = DEP_BTC_YIELD_PROVIDER_DEPOSITED;
                        deposit.remarks.clear();
                    }
                    DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT => {
                        deposit.status = DEP_BTC_DEPOSITED_INTO_ATLAS;
                        deposit.remarks.clear();
                    }
                    DEP_BTC_PENDING_MINTED_INTO_ABTC => {
                        deposit.status = DEP_BTC_YIELD_PROVIDER_DEPOSITED;
                        deposit.remarks.clear();
                    }
                    DEP_BTC_DEPOSITED_INTO_ATLAS => {
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
        self.assert_admin();

        
        // Validate input parameters
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        log!("Gas value: {}", gas);
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

                        if path == "EVM" {
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
                        } else if path == "NEAR" {
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

    pub fn create_deposit_bithive_signed_payload(
        &mut self,
        payload: Vec<u8>,  // Passing the payload
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

    // Increments deposit record's verified_count by 1 based on the mempool_deposit record passed in
    // Caller of this function has to be an authorised validator for the particular chain_id of the redemption record
    // Caller of this function has to be a new validator of this btc_txn_hash
    // Checks all fields of mempool_record equal to deposit record
    // Returns true if verified_count incremented successfully and returns false if not incremented
    pub fn increment_deposit_verified_count(&mut self, mempool_deposit: DepositRecord) -> bool {
        let caller: AccountId = env::predecessor_account_id();

        // Validate the mempool_deposit
        if mempool_deposit.btc_txn_hash.is_empty() {
            log!("Invalid mempool_deposit: btc_txn_hash is empty");
            return false;
        }

        // Retrieve the deposit record using the btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&mempool_deposit.btc_txn_hash).cloned() {
            let chain_id = SIGNET.to_string();

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
                    || deposit.timestamp != mempool_deposit.timestamp
                    || deposit.status != DEP_BTC_DEPOSITED_INTO_ATLAS
                    || deposit.remarks != mempool_deposit.remarks
                {
                    log!("Mismatch between near_deposit and mempool_deposit records. Verification failed.");
                    return false;
                }

                // Increment the verified count
                deposit.verified_count += 1;

                // Clone deposit before inserting it to avoid moving it
                let cloned_deposit = deposit.clone();

                // Update the deposit record in the map
                self.deposits
                    .insert(deposit.btc_txn_hash.clone(), cloned_deposit);

                // Add the caller to the list of validators for this btc_txn_hash
                validators_list.push(caller);
                self.verifications
                    .insert(deposit.btc_txn_hash.clone(), validators_list);

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

    pub fn update_yield_provider_txn_hash(&mut self, btc_txn_hash: String, yield_provider_txn_hash: String) {
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
            deposit.yield_provider_txn_hash = yield_provider_txn_hash;
            self.deposits.insert(btc_txn_hash.clone(), deposit);
            log!(
                "Yield provider transaction hash updated for btc_txn_hash: {}",
                btc_txn_hash
            );
        } else {
            env::panic_str("Deposit record not found");
        }
    }
    
}
