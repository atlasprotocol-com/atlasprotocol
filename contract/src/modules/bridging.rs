use crate::atlas::Atlas;
use crate::chain_configs::ChainConfigRecord;
use crate::constants::delimiter::COMMA;
use crate::constants::near_gas::*;
use crate::constants::status::*;
use crate::modules::signer::*;
use crate::modules::structs::BridgingRecord;
use crate::AtlasExt;
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
    pub fn insert_bridging_abtc(
        &mut self,
        txn_hash: String,
        origin_chain_id: String,
        origin_chain_address: String,
        dest_chain_id: String,
        dest_chain_address: String,
        dest_txn_hash: String,
        abtc_amount: u64,
        timestamp: u64,
        status: u8,
        remarks: String,
        date_created: u64,
    ) {
        self.assert_admin();

        let protocol_fee = self.get_bridging_protocol_fee(abtc_amount);
        let record = BridgingRecord {
            txn_hash: txn_hash.clone(),
            origin_chain_id,
            origin_chain_address,
            dest_chain_id,
            dest_chain_address,
            dest_txn_hash,
            abtc_amount,
            protocol_fee,
            timestamp,
            status,
            remarks,
            date_created,
            verified_count: 0,
        };

        self.bridgings.insert(txn_hash, record);
    }

    pub fn get_bridging_by_txn_hash(&self, txn_hash: String) -> Option<BridgingRecord> {
        self.bridgings.get(&txn_hash).cloned()
    }

    pub fn get_bridgings_by_origin_chain_id_and_address(
        &self,
        origin_chain_id: String,
        origin_chain_address: String,
    ) -> Vec<BridgingRecord> {
        self.bridgings
            .values()
            .filter(|record| {
                record.origin_chain_id == origin_chain_id
                    && record.origin_chain_address == origin_chain_address
            })
            .cloned()
            .collect()
    }

    pub fn get_bridgings_by_dest_chain_id_and_address(
        &self,
        dest_chain_id: String,
        dest_chain_address: String,
    ) -> Vec<BridgingRecord> {
        self.bridgings
            .values()
            .filter(|record| {
                record.dest_chain_id == dest_chain_id
                    && record.dest_chain_address == dest_chain_address
            })
            .cloned()
            .collect()
    }

    pub fn get_bridgings_by_timestamp(
        &self,
        start_time: u64,
        end_time: u64,
    ) -> Vec<BridgingRecord> {
        self.bridgings
            .values()
            .filter(|record| record.timestamp >= start_time && record.timestamp <= end_time)
            .cloned()
            .collect()
    }

    pub fn get_all_bridgings(&self) -> Vec<BridgingRecord> {
        let mut valid_records = Vec::new();
    
        for record in self.bridgings.values() {
            // No need to match since we're not dealing with Results
            valid_records.push(record.clone());
        }
        
        valid_records
    }

    pub fn get_bridgings_count(&self) -> u64 {
        self.bridgings.len() as u64
    }

    pub fn update_bridging_btc_bridged(&mut self, txn_hash: String, timestamp: u64) {
        self.assert_admin();
        if let Some(mut bridging) = self.bridgings.get(&txn_hash).cloned() {
            bridging.status = BRG_ABTC_BURNT;
            bridging.timestamp = timestamp;
            self.bridgings.insert(txn_hash, bridging);
        } else {
            env::panic_str("Deposit record not found");
        }
    }

    pub fn update_bridging_timestamp(&mut self, txn_hash: String, timestamp: u64) {
        self.assert_admin();
        if let Some(mut bridging) = self.bridgings.get(&txn_hash).cloned() {
            bridging.timestamp = timestamp;
            self.bridgings.insert(txn_hash, bridging);
        } else {
            env::panic_str("Bridging record not found");
        }
    }

    pub fn update_bridging_remarks(&mut self, txn_hash: String, remarks: String) {
        self.assert_admin();
        if let Some(mut bridging) = self.bridgings.get(&txn_hash).cloned() {
            bridging.remarks = remarks;
            self.bridgings.insert(txn_hash, bridging);
        } else {
            env::panic_str("Bridging record not found");
        }
    }

    pub fn update_bridging_minted(
        &mut self,
        txn_hash: String,
        dest_txn_hash: String,
        timestamp: u64,
    ) {
        self.assert_admin();
        if let Some(mut bridging) = self.bridgings.get(&txn_hash).cloned() {
            bridging.status = BRG_ABTC_MINTED_TO_DEST;
            bridging.dest_txn_hash = dest_txn_hash;
            bridging.timestamp = timestamp;
            self.bridgings.insert(txn_hash, bridging);
        } else {
            env::panic_str("Bridging record not found");
        }
    }

    pub fn get_first_valid_bridging_chain_config(&self) -> Option<(String, ChainConfigRecord)> {
        for (key, bridging) in self.bridgings.iter() {
            if bridging.origin_chain_id != ""
                && bridging.origin_chain_address != ""
                && bridging.dest_chain_id != ""
                && bridging.dest_chain_address != ""
                && bridging.status == BRG_ABTC_BURNT
                && bridging.remarks == ""
            {
                // Get the chain config using bridging.dest_chain_id
                if let Some(chain_config) = self
                    .chain_configs
                    .get_chain_config(bridging.dest_chain_id.clone())
                {
                    // Check if the verified_count meets or exceeds the validators_threshold
                    if bridging.verified_count >= chain_config.validators_threshold {
                        log!(
                            "Bridging's verified_count ({}) meets or exceeds the validators_threshold ({})",
                            bridging.verified_count,
                            chain_config.validators_threshold
                        );
                        return Some((key.clone(), chain_config)); // Return the key and the ChainConfigRecord as a tuple
                    }
                }
            }
        }

        None // If no matching bridging or chain config is found, return None
    }

    pub fn create_bridging_abtc_signed_tx(
        &mut self,
        txn_hash: String,
        nonce: u64,
        gas: u128,
        max_fee_per_gas: u128,
        max_priority_fee_per_gas: u128,
    ) -> PromiseOrValue<String> {
        self.assert_admin();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");
        assert!(gas != 0, "Gas cannot be zero");

        // Check if the bridging exists for the given txn_hash
        if let Some(mut bridging) = self.bridgings.get(&txn_hash).cloned() {
            if bridging.origin_chain_id != ""
                && bridging.origin_chain_address != ""
                && bridging.dest_chain_id != ""
                && bridging.dest_chain_address != ""
                && bridging.status == BRG_ABTC_BURNT
                && bridging.remarks == ""
                && bridging.dest_txn_hash == ""
            // This will stop re-minting as no one can update this once minted
            {
                // Get the chain config using the bridging's receiving_chain_id
                if let Some(chain_config) = self
                    .chain_configs
                    .get_chain_config(bridging.dest_chain_id.clone())
                {
                    // Ensure the bridging's verified_count meets or exceeds the chain's validators_threshold
                    if bridging.verified_count >= chain_config.validators_threshold {
                        log!(
                            "Deposit's verified_count ({}) meets or exceeds the validators_threshold ({})",
                            bridging.verified_count,
                            chain_config.validators_threshold
                        );

                        // Get the "path" dynamically from the chain config (e.g., "EVM", "NEAR")
                        let path = chain_config.network_type.clone(); // Assuming network_type represents the path

                        log!("Found chain config for chain_id: {}", path);

                        bridging.status = BRG_ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST;

                        // Update the bridging in the map
                        self.bridgings.insert(txn_hash.clone(), bridging.clone());

                        if path == "EVM" {
                            // Check if the receiving address is a valid EVM address
                            if !Self::is_valid_eth_address(bridging.dest_chain_address.clone()) {
                                // Set remarks if the address is not a valid EVM address
                                let error_msg =
                                    "Receiving address is not a valid EVM address".to_string();

                                bridging.remarks = error_msg.clone();

                                // Update the bridging in the map
                                self.bridgings.insert(txn_hash.clone(), bridging.clone());

                                // Exit early since the address is not valid
                                return PromiseOrValue::Value(error_msg);
                            }

                            // Ensure the BTC amount is properly converted to U256 (Ethereum uint256)
                            let amount = U256::from(bridging.abtc_amount);

                            let to_address_str =
                                chain_config.abtc_address.strip_prefix("0x").unwrap();
                            let to_address = parse_eth_address(to_address_str);
                            let destination = H160::from_slice(
                                &hex::decode(
                                    bridging.dest_chain_address.strip_prefix("0x").unwrap(),
                                )
                                .expect("Invalid hex address"),
                            );
                            let value_as_128 = 0;

                            let data: Vec<u8> = Self::encode_bridging_function_call(
                                destination,
                                amount,
                                bridging.origin_chain_id.clone(),
                                bridging.origin_chain_address.clone(),
                                bridging.txn_hash.clone(),
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
                                    bridging
                                        .dest_chain_id
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
                                            .bridging_sign_callback(evm_tx),
                                    ),
                            );
                        } else if path == "NEAR" {
                            log!(
                                "Minting aBTC on NEAR chain for bridging with origin_chain_address: {}",
                                bridging.origin_chain_address
                            );

                            let account_id_str = chain_config.abtc_address.clone().to_string();
                            let account_id = AccountId::from_str(&account_id_str)
                                .expect("Invalid NEAR account ID");

                            // Check if the account has enough storage
                            let storage_check_args = json!({
                                "account_id": bridging.dest_chain_address
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

                            let args_json_string = json!({
                                "account_id": bridging.dest_chain_address,
                                "amount": bridging.abtc_amount.to_string(),
                                "origin_chain_id": bridging.origin_chain_id,
                                "origin_chain_address": bridging.origin_chain_address,
                                "origin_txn_hash": bridging.txn_hash
                            })
                            .to_string();

                            let mint_promise = Promise::new(account_id.clone()).function_call(
                                "mint_bridge".to_string(),     // The mint function to call
                                args_json_string.into_bytes(), // The arguments for minting
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
                            bridging.verified_count,
                            chain_config.validators_threshold
                        );
                        return PromiseOrValue::Value("Validators threshold not met.".to_string());
                    }
                } else {
                    log!(
                        "Chain config not found for chain_id: {}",
                        bridging.dest_chain_id
                    );
                    return PromiseOrValue::Value("Chain config not found.".to_string());
                }
            }
        }

        PromiseOrValue::Value("Bridge record is not found or invalid conditions.".to_string())
    }

    #[private]
    pub fn bridging_sign_callback(
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

            let near_tx_signed = evm_tx.build_with_signature(&signature_omni);

            log!("EVM_SIGNED_TRANSACTION: {}", hex::encode(&near_tx_signed));

            // Return the signed transaction here
            return near_tx_signed;
        } else {
            panic!("Callback failed");
        }
    }

    // Helper function to encode the mint function call
    fn encode_bridging_function_call(
        to_address: H160,
        amount: U256,
        origin_chain_id: String,
        origin_chain_address: String,
        origin_txn_hash: String,
    ) -> Vec<u8> {
        let mint_function_signature = "mintBridge(address,uint256,string,string,string)"; // Updated Solidity function signature

        // Compute the Keccak-256 hash of the function signature and take the first 4 bytes
        let function_selector = &keccak256(mint_function_signature.as_bytes())[0..4];

        // Encode the function call with the address, amount, and BTC transaction hash
        let mut encoded = ethabi::encode(&[
            ethabi::Token::Address(to_address), // Address as 20 bytes (H160)
            ethabi::Token::Uint(amount),        // Uint256 as 32 bytes (U256)
            ethabi::Token::String(origin_chain_id),
            ethabi::Token::String(origin_chain_address),
            ethabi::Token::String(origin_txn_hash),
        ]);

        // Prepend the function selector to the encoded parameters
        let mut function_call_data = Vec::with_capacity(function_selector.len() + encoded.len());
        function_call_data.extend_from_slice(function_selector); // Add the function selector
        function_call_data.append(&mut encoded); // Add the encoded parameters

        function_call_data
    }

    // Increments bridging record's verified_count by 1 based on the mempool_bridging record passed in
    // Caller of this function has to be an authorized validator for the particular origin_chain_id of the bridging record
    // Caller of this function has to be a new validator of this txn_hash
    // Checks all fields of mempool_record equal to bridging record
    // Returns true if verified_count incremented successfully and returns false if not incremented
    pub fn increment_bridging_verified_count(&mut self, mempool_bridging: BridgingRecord) -> bool {
        let caller = env::predecessor_account_id();

        // Split the txn_hash in the format "<origin_txn_hash>,<origin_chain_id>" using the COMMA delimiter
        let mempool_bridging_txn_hash: Vec<&str> = mempool_bridging.txn_hash.split(COMMA).collect();

        if mempool_bridging_txn_hash.len() != 2 {
            log!(
                "Invalid bridging record's txn_hash format: {}",
                mempool_bridging.txn_hash
            );
            return false;
        }

        //let origin_txn_hash = mempool_bridging_txn_hash[0];
        let origin_chain_id = mempool_bridging_txn_hash[0].to_string();

        // Retrieve the bridging record using the txn_hash
        if let Some(mut bridging) = self.bridgings.get(&mempool_bridging.txn_hash).cloned() {
            // Check if the origin_chain_id matches
            if bridging.origin_chain_id != origin_chain_id {
                log!(
                    "Bridging record's Chain ID mismatch: expected {}, found {}",
                    bridging.origin_chain_id,
                    origin_chain_id
                );
                return false;
            }

            // Use the is_validator function to check if the caller is authorized for the origin chain ID
            if self.is_validator(&caller, &origin_chain_id) {
                // Retrieve the list of validators for this txn_hash using the getter method
                let mut validators_list =
                    self.get_validators_by_txn_hash(bridging.txn_hash.clone());

                // Check if the caller has already verified this txn_hash
                if validators_list.contains(&caller) {
                    log!(
                        "Caller {} has already verified the transaction with txn_hash: {}.",
                        &caller,
                        &bridging.txn_hash
                    );
                    return false;
                }

                // Verify that all fields of bridging and mempool_bridging are equal
                if bridging.txn_hash != mempool_bridging.txn_hash
                    || bridging.origin_chain_id != mempool_bridging.origin_chain_id
                    || bridging.origin_chain_address != mempool_bridging.origin_chain_address
                    || bridging.dest_chain_id != mempool_bridging.dest_chain_id
                    || bridging.dest_chain_address != mempool_bridging.dest_chain_address
                    || bridging.abtc_amount != mempool_bridging.abtc_amount
                    || bridging.timestamp != mempool_bridging.timestamp
                    || bridging.status != mempool_bridging.status
                    || bridging.remarks != mempool_bridging.remarks
                {
                    log!("Mismatch between near_bridging and mempool_bridging records. Verification failed.");
                    return false;
                }

                // Increment the verified count
                bridging.verified_count += 1;

                // Clone bridging before inserting it to avoid moving it
                let cloned_bridging = bridging.clone();

                // Update the bridging record in the map
                self.bridgings
                    .insert(bridging.txn_hash.clone(), cloned_bridging);

                // Add the caller to the list of validators for this txn_hash
                validators_list.push(caller);
                self.verifications
                    .insert(bridging.txn_hash.clone(), validators_list);

                true // success case returns true
            } else {
                log!(
                    "Caller {} is not an authorized validator for the chain ID: {}",
                    &caller,
                    &origin_chain_id
                );
                return false;
            }
        } else {
            log!(
                "Bridging record not found for txn_hash: {}.",
                &mempool_bridging.txn_hash
            );
            return false;
        }
    }

    pub fn rollback_bridging_status_by_txn_hash(&mut self, txn_hash: String) {
        self.assert_not_paused();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");

        // Retrieve the bridging record based on txn_hash
        if let Some(mut bridging) = self.bridgings.get(&txn_hash).cloned() {
            if !bridging.origin_chain_address.is_empty()
                && !bridging.origin_chain_id.is_empty()
                && !bridging.dest_chain_address.is_empty()
                && !bridging.dest_chain_id.is_empty()
                && !bridging.remarks.is_empty()
            {
                match bridging.status {
                    BRG_ABTC_BURNT => {
                        bridging.remarks.clear();
                    },
                    BRG_ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST => {
                        bridging.status = BRG_ABTC_BURNT;
                        bridging.remarks.clear();
                    },
                    _ => {
                        // No action needed for other statuses
                    }
                }

                // Update the bridging record in the map
                self.bridgings.insert(txn_hash, bridging);
            }
        } else {
            env::log_str("Bridging record not found for the given txn hash");
        }
    }

 }
