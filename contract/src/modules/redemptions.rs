use crate::constants::network_type::*;
use crate::constants::delimiter::COMMA;
use crate::modules::structs::RedemptionRecord;
use crate::modules::structs::CreatePayloadResult;
use crate::modules::structs::UtxoInput;
use crate::constants::status::*;
use crate::Atlas;
use crate::AtlasExt;
use near_sdk::{near_bindgen, env, log, AccountId};
use bitcoin::util::psbt::PartiallySignedTransaction as Psbt;
use bitcoin::blockdata::transaction::{Transaction, TxOut};
use bitcoin::consensus::encode::serialize;
use bitcoin::util::address::Address;
use std::str::FromStr;

#[near_bindgen]
impl Atlas {
    pub fn insert_redemption_abtc(
        &mut self,
        txn_hash: String,
        abtc_redemption_address: String,
        abtc_redemption_chain_id: String,
        btc_receiving_address: String,
        abtc_amount: u64,
        timestamp: u64,
        date_created: u64,
    ) {
        self.assert_not_paused();
        self.assert_admin();

        // Input validation
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");
        assert!(
            !abtc_redemption_address.is_empty(),
            "atBTC redemption address cannot be empty"
        );
        assert!(
            !abtc_redemption_chain_id.is_empty(),
            "atBTC redemption chain ID cannot be empty"
        );
        assert!(
            !btc_receiving_address.is_empty(),
            "BTC receiving address cannot be empty"
        );
        assert!(abtc_amount > 0, "atBTC amount must be greater than zero");
        assert!(timestamp > 0, "Timestamp must be greater than zero");
        assert!(date_created > 0, "Date created must be greater than zero");

        // Check for existing redemption
        assert!(
            self.redemptions.get(&txn_hash).is_none(),
            "Redemption with this transaction hash already exists"
        );
        
        let protocol_fee = self.get_redemption_protocol_fee(abtc_amount);

        let record = RedemptionRecord {
            txn_hash: txn_hash.clone(),
            abtc_redemption_address,
            abtc_redemption_chain_id,
            btc_receiving_address,
            abtc_amount,
            btc_txn_hash: "".to_string(),
            btc_redemption_fee: 0,
            protocol_fee,
            timestamp,
            status: RED_ABTC_BURNT,
            remarks: "".to_string(),
            date_created,
            verified_count: 0,
            yield_provider_gas_fee: 0,
            yield_provider_txn_hash: "".to_string(),
            btc_txn_hash_verified_count: 0,
        };

        self.redemptions.insert(txn_hash, record);
    }

    pub fn get_redemption_by_txn_hash(&self, txn_hash: String) -> Option<RedemptionRecord> {
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");

        self.redemptions.get(&txn_hash).cloned()
    }

    pub fn get_redemptions_for_yield_provider_by_status_and_timestamp(&self, status: u8, timestamp: u64) -> Vec<RedemptionRecord> {
        self.redemptions
            .values()
            .filter(|record| {
                record.status == status 
                && record.verified_count >= self.chain_configs.get_chain_config(record.abtc_redemption_chain_id.clone()).unwrap().validators_threshold
                && record.remarks.is_empty()
                && record.timestamp <= timestamp
            })
            .cloned()
            .collect()
    }

    pub fn get_redemptions_by_abtc_redemption_address(
        &self,
        abtc_redemption_address: String,
    ) -> Vec<RedemptionRecord> {
        assert!(
            !abtc_redemption_address.is_empty(),
            "atBTC redemption address cannot be empty"
        );

        self.redemptions
            .values()
            .filter(|record| record.abtc_redemption_address == abtc_redemption_address)
            .cloned()
            .collect()
    }

    pub fn get_redemptions_by_btc_receiving_address(
        &self,
        btc_receiving_address: String,
    ) -> Vec<RedemptionRecord> {
        assert!(
            !btc_receiving_address.is_empty(),
            "BTC receiving address cannot be empty"
        );

        self.redemptions
            .values()
            .filter(|record| record.btc_receiving_address == btc_receiving_address)
            .cloned()
            .collect()
    }

    pub fn get_redemptions_by_timestamp(
        &self,
        start_time: u64,
        end_time: u64,
    ) -> Vec<RedemptionRecord> {
        // Validate input parameters
        assert!(
            start_time <= end_time,
            "Start time must be less than or equal to end time"
        );

        self.redemptions
            .values()
            .filter(|record| record.timestamp >= start_time && record.timestamp <= end_time)
            .cloned()
            .collect()
    }

    pub fn get_all_redemptions(&self) -> Vec<RedemptionRecord> {
        self.redemptions.values().cloned().collect()
    }

    pub fn get_redemptions_count(&self) -> u64 {
        self.redemptions.len() as u64
    }

    pub fn get_redemptions_to_send_btc(&self, batch_size: u64) -> Vec<RedemptionRecord> {
        self.redemptions
            .values()
            .filter(|record: &&RedemptionRecord| {
                if let Some(chain_config) = self.chain_configs.get_chain_config(record.abtc_redemption_chain_id.clone()) {
                    record.status == RED_BTC_YIELD_PROVIDER_WITHDRAWN
                        && record.verified_count >= chain_config.validators_threshold
                        && record.remarks.is_empty()
                } else {
                    false
                }
            })
            .take(batch_size as usize)
            .cloned()
            .collect()
    }

    pub fn update_redemption_pending_btc_mempool(
        &mut self,
        txn_hashes: Vec<String>,
        btc_txn_hash: String
    ) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!txn_hashes.is_empty(), "Transaction hashes cannot be empty");
        assert!(!btc_txn_hash.is_empty(), "BTC transaction hash cannot be empty");

        // Process each transaction hash
        for txn_hash in txn_hashes {
            // Retrieve the redemption record based on txn_hash
            if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
                // Fetch chain configuration for the redemption's chain_id
                if let Some(chain_config) = self
                    .chain_configs
                    .get_chain_config(redemption.abtc_redemption_chain_id.clone())
                {
                    // Fetch chain configuration for the bitcoin redemption
                    let btc_chain_id = if self.is_production_mode() {
                        BITCOIN.to_string()
                    } else {
                        TESTNET4.to_string()
                    };

                    if let Some(btc_chain_config) = self
                        .chain_configs
                        .get_chain_config(btc_chain_id.clone())
                    {
                        // Check all specified conditions
                        if redemption.status == RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER
                            && redemption.verified_count >= chain_config.validators_threshold
                            && redemption.remarks.is_empty()
                            && redemption.btc_txn_hash.is_empty()
                        {
                            // All conditions are met, proceed to update the redemption status and btc_txn_hash
                            redemption.status = RED_BTC_PENDING_MEMPOOL_CONFIRMATION;
                            redemption.btc_txn_hash = btc_txn_hash.clone();
                            
                            self.redemptions.insert(txn_hash.clone(), redemption);
                            log!("Redemption status updated to RED_BTC_PENDING_MEMPOOL_CONFIRMATION for txn_hash: {}", txn_hash);
                        } else {
                            // Log a message if conditions are not met
                            log!(
                                "Conditions not met for updating redemption pending btc mempool for txn_hash: {}. 
                                 Status: {}, Verified count: {}, BTC txn hash verified count: {}, Remarks: {}, BTC txn hash: {}",
                                txn_hash,
                                redemption.status,
                                redemption.verified_count,
                                redemption.btc_txn_hash_verified_count,
                                redemption.remarks,
                                redemption.btc_txn_hash
                            );
                        }
                    } else {
                        env::panic_str("Bitcoin chain configuration not found");
                    }
                } else {
                    env::panic_str("Chain configuration not found for redemption chain ID");
                }
            } else {
                env::panic_str("Redemption record not found");
            }
        }
    }

    pub fn update_redemption_redeemed(&mut self, txn_hash: String) {

        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");

        // Retrieve the redemption record based on txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            // Fetch chain configuration for the redemption's chain ID
            if let Some(chain_config) = self
                .chain_configs
                .get_chain_config(redemption.abtc_redemption_chain_id.clone())
            {
                // Fetch chain configuration for the bitcoin redemption
                let btc_chain_id = if self.is_production_mode() {
                    BITCOIN.to_string()
                } else {
                    TESTNET4.to_string()
                };
                
                if let Some(btc_chain_config) = self
                    .chain_configs
                    .get_chain_config(btc_chain_id.clone())
                {
                    // Check all specified conditions
                    if (redemption.status == RED_BTC_PENDING_MEMPOOL_CONFIRMATION)
                        && redemption.verified_count >= chain_config.validators_threshold
                        && redemption.btc_txn_hash_verified_count >= btc_chain_config.validators_threshold
                        && redemption.remarks.is_empty()
                    {
                        // All conditions are met, proceed to update the redemption status
                        redemption.status = RED_BTC_REDEEMED_BACK_TO_USER;                    
                        redemption.timestamp = env::block_timestamp() / 1_000_000_000;
                        self.redemptions.insert(txn_hash.clone(), redemption);
                        log!("Redemption status updated to RED_BTC_REDEEMED_BACK_TO_USER for txn_hash: {}", txn_hash);
                    } else {
                        // Log a message if conditions are not met
                        log!(
                            "Conditions not met for updating redemption redeemed status for txn_hash: {}. 
                            Status: {}, Verified count: {}, Remarks: {}, BTC txn hash: {}, BTC txn hash verified count: {}",
                            txn_hash,
                            redemption.status,
                            redemption.verified_count,
                            redemption.remarks,
                            redemption.btc_txn_hash,
                            redemption.btc_txn_hash_verified_count
                        );
                    }
                } else {
                    env::panic_str("Chain configuration not found for bitcoin redemption");
                }    
            } else {
                env::panic_str("Chain configuration not found for redemption chain ID");
            }
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_pending_yield_provider_withdraw(&mut self, txn_hash: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");

        // Retrieve the redemption record based on txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            // Fetch chain configuration for the redemption's chain ID
            if let Some(chain_config) = self
                .chain_configs
                .get_chain_config(redemption.abtc_redemption_chain_id.clone())
            {
                // Check all specified conditions
                if redemption.status == RED_BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING
                    && redemption.verified_count >= chain_config.validators_threshold
                    && redemption.remarks.is_empty()
                {
                    // All conditions are met, proceed to update the redemption status
                    redemption.status = RED_BTC_PENDING_YIELD_PROVIDER_WITHDRAW;
                    redemption.timestamp = env::block_timestamp() / 1_000_000_000;
                    self.redemptions.insert(txn_hash.clone(), redemption);

                    log!("Redemption status updated to RED_BTC_PENDING_YIELD_PROVIDER_WITHDRAW for txn_hash: {}", txn_hash);
                } else {
                    // Panic with the expected message if conditions are not met
                    env::panic_str("Conditions not met for updating redemption status");
                }
            } else {
                env::panic_str("Chain configuration not found for redemption chain ID");
            }
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_yield_provider_withdrawing(&mut self, txn_hash: String, yield_provider_txn_hash: String, yield_provider_gas_fee: u64) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");
        assert!(!yield_provider_txn_hash.is_empty(), "Yield provider transaction hash cannot be empty");
        assert!(yield_provider_gas_fee > 0, "Yield provider gas fee must be greater than zero");

        // Retrieve the redemption record based on txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            // Fetch chain configuration for the redemption's chain ID
            if let Some(chain_config) = self
                .chain_configs
                .get_chain_config(redemption.abtc_redemption_chain_id.clone())
            {
                // Check all specified conditions
                if redemption.status == RED_BTC_PENDING_YIELD_PROVIDER_WITHDRAW
                    && redemption.verified_count >= chain_config.validators_threshold
                    && redemption.remarks.is_empty()
                    && redemption.btc_txn_hash.is_empty()
                    && redemption.yield_provider_txn_hash.is_empty()
                    && redemption.yield_provider_gas_fee == 0
                {
                    // All conditions are met, proceed to update the redemption status
                    redemption.status = RED_BTC_YIELD_PROVIDER_WITHDRAWING;
                    redemption.yield_provider_txn_hash = yield_provider_txn_hash;
                    redemption.yield_provider_gas_fee = yield_provider_gas_fee;
                    redemption.timestamp = env::block_timestamp() / 1_000_000_000;
                    self.redemptions.insert(txn_hash.clone(), redemption);

                    log!("Redemption status updated to RED_BTC_YIELD_PROVIDER_WITHDRAWING for txn_hash: {}", txn_hash);
                } else {
                    // Panic with the expected message if conditions are not met
                    env::panic_str("Conditions not met for updating redemption status");
                }
            } else {
                env::panic_str("Chain configuration not found for redemption chain ID");
            }
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_yield_provider_withdrawn(&mut self, txn_hash: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");
        // Retrieve the redemption record based on txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            // Fetch chain configuration for the redemption's chain ID
            if let Some(chain_config) = self
                .chain_configs
                .get_chain_config(redemption.abtc_redemption_chain_id.clone())
            {
                // Check all specified conditions
                if redemption.status == RED_BTC_YIELD_PROVIDER_WITHDRAWING
                    && redemption.verified_count >= chain_config.validators_threshold
                    && redemption.remarks.is_empty()
                    && redemption.btc_txn_hash.is_empty()
                    && !redemption.yield_provider_txn_hash.is_empty()
                    && redemption.yield_provider_gas_fee > 0
                {
                    // All conditions are met, proceed to update the redemption status
                    redemption.status = RED_BTC_YIELD_PROVIDER_WITHDRAWN;
                    redemption.timestamp = env::block_timestamp() / 1_000_000_000;
                    self.redemptions.insert(txn_hash.clone(), redemption);

                    log!("Redemption status updated to RED_BTC_YIELD_PROVIDER_WITHDRAWN for txn_hash: {}", txn_hash);
                } else {
                    // Panic with the expected message if conditions are not met
                    env::panic_str("Conditions not met for updating redemption status");
                }
            } else {
                env::panic_str("Chain configuration not found for redemption chain ID");
            }
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_remarks(&mut self, txn_hash: String, remarks: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");
        assert!(!remarks.trim().is_empty(), "Remarks cannot be blank");

        // Retrieve the redemption record based on txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            // Fetch chain configuration for the redemption's chain ID
            if let Some(chain_config) = self
                .chain_configs
                .get_chain_config(redemption.abtc_redemption_chain_id.clone())
            {
                // Check all specified conditions
                if redemption.status != RED_BTC_REDEEMED_BACK_TO_USER
                    && redemption.verified_count >= chain_config.validators_threshold
                {
                    // All conditions are met, proceed to update the remarks
                    redemption.remarks = remarks;
                    self.redemptions.insert(txn_hash.clone(), redemption);
                    log!("Remarks updated for txn_hash: {}", txn_hash);
                } else {
                    // Log a message if conditions are not met
                    log!(
                        "Conditions not met for updating remarks for txn_hash: {}. 
                         Status: {}, Verified count: {}, Validators threshold: {}, Current remarks: {}",
                        txn_hash,
                        redemption.status,
                        redemption.verified_count,
                        chain_config.validators_threshold,
                        redemption.remarks
                    );
                }
            } else {
                env::panic_str("Chain configuration not found for redemption chain ID");
            }
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn rollback_redemption_status_by_txn_hash(&mut self, txn_hash: String) {
        self.assert_not_paused();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");

        // Retrieve the redemption record based on txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            if !redemption.abtc_redemption_address.is_empty()
                && !redemption.abtc_redemption_chain_id.is_empty()
                && !redemption.btc_receiving_address.is_empty()
                //&& !redemption.remarks.is_empty()
            {
                match redemption.status {
                    RED_BTC_PENDING_YIELD_PROVIDER_UNSTAKE => {
                        redemption.status = RED_ABTC_BURNT;
                        redemption.remarks.clear();
                    },
                    RED_BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING => {
                        redemption.status = RED_ABTC_BURNT;
                        redemption.remarks.clear();
                    },
                    RED_BTC_YIELD_PROVIDER_UNSTAKED => {
                        redemption.status = RED_ABTC_BURNT;
                        redemption.remarks.clear();
                    },
                    RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER => {
                        redemption.status = RED_BTC_YIELD_PROVIDER_WITHDRAWN;
                        redemption.remarks.clear();
                    },
                    RED_BTC_PENDING_YIELD_PROVIDER_WITHDRAW => {
                        redemption.status = RED_BTC_YIELD_PROVIDER_UNSTAKED;
                        redemption.remarks.clear();
                    },
                    RED_BTC_YIELD_PROVIDER_WITHDRAWING => {
                        redemption.remarks.clear();
                        if redemption.yield_provider_gas_fee == 0 {
                            redemption.status = RED_ABTC_BURNT;
                        }
                    },
                    RED_BTC_YIELD_PROVIDER_WITHDRAWN => {
                        redemption.remarks.clear();
                    },
                    RED_BTC_PENDING_MEMPOOL_CONFIRMATION => {
                        redemption.remarks.clear();
                    },
                    _ => {
                        // No action needed for other statuses
                    }
                }

                // Update the redemption record in the map
                self.redemptions.insert(txn_hash, redemption);
            }
        } else {
            env::log_str("Redemption record not found for the given txn hash");
        }
    }

    pub fn rollback_all_redemption_status(&mut self) {
        self.assert_not_paused();

        // Collect the keys and redemptions that need to be updated
        let updates: Vec<(String, RedemptionRecord)> = self
            .redemptions
            .iter()
            .filter_map(|(key, redemption)| {
                let mut redemption = redemption.clone(); // Clone the redemption to modify it
                if !redemption.abtc_redemption_address.is_empty()
                    && !redemption.abtc_redemption_chain_id.is_empty()
                    && !redemption.btc_receiving_address.is_empty()
                    && !redemption.remarks.is_empty()
                {
                    match redemption.status {
                        RED_BTC_PENDING_YIELD_PROVIDER_UNSTAKE => {
                            redemption.status = RED_ABTC_BURNT;
                            redemption.remarks.clear();
                            Some((key.clone(), redemption))  // Clone the key and return the updated redemption
                        },
                        RED_BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING => {
                            redemption.remarks.clear();
                            Some((key.clone(), redemption))  // Clone the key and return the updated redemption
                        },
                        RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER => {
                            redemption.status = RED_BTC_YIELD_PROVIDER_WITHDRAWN;
                            redemption.remarks.clear();
                            Some((key.clone(), redemption))  // Clone the key and return the updated redemption
                        },
                        RED_BTC_PENDING_MEMPOOL_CONFIRMATION => {
                            redemption.status = RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER;
                            redemption.remarks.clear();
                            Some((key.clone(), redemption))  // Clone the key and return the updated redemption
                        },
                        RED_BTC_PENDING_YIELD_PROVIDER_WITHDRAW => {
                            redemption.status = RED_BTC_YIELD_PROVIDER_UNSTAKED;
                            redemption.remarks.clear();
                            Some((key.clone(), redemption))
                        },
                        RED_BTC_YIELD_PROVIDER_WITHDRAWING => {
                            redemption.remarks.clear();
                            Some((key.clone(), redemption))
                        },
                        RED_BTC_YIELD_PROVIDER_WITHDRAWN => {
                            redemption.remarks.clear();
                            Some((key.clone(), redemption))
                        },
                        _ => None,
                    }
                } else {
                    None
                }
            })
            .collect();

        // Apply the updates
        for (key, redemption) in updates {
            self.redemptions.insert(key, redemption);
        }
    }

    pub fn get_first_valid_user_redemption(&self) -> Option<(String, u64)> {
        for (txn_hash, redemption) in self.redemptions.iter() {
            // Ensure basic redemption criteria
            if redemption.btc_receiving_address != ""
                && redemption.status == RED_ABTC_BURNT
                && redemption.remarks == ""
                && redemption.btc_txn_hash == "" 
            {
                // Fetch the chain configuration for the corresponding redemption chain ID
                if let Some(chain_config) = self.chain_configs.get_chain_config(redemption.abtc_redemption_chain_id.clone()) {
                    // Ensure that the verified_count meets or exceeds the validators_threshold
                    if redemption.verified_count >= chain_config.validators_threshold {
                        log!(
                            "Found valid redemption with txn_hash: {} and verified_count: {} (threshold: {})",
                            txn_hash,
                            redemption.verified_count,
                            chain_config.validators_threshold
                        );
                        return Some((txn_hash.clone(), redemption.abtc_amount.clone())); // Return the first matching txn_hash
                    } 
                } 
            }
        }
        None // If no matching redemption is found, return None
    }

    pub fn get_first_valid_redemption(&self) -> Option<String> {
        for (txn_hash, redemption) in self.redemptions.iter() {
            // Ensure basic redemption criteria
            if redemption.btc_receiving_address != ""
                && redemption.status == RED_BTC_YIELD_PROVIDER_WITHDRAWN
                && redemption.remarks == ""
                && redemption.btc_txn_hash == ""
                && redemption.yield_provider_txn_hash != ""
                && redemption.yield_provider_gas_fee > 0
            {
                // Fetch the chain configuration for the corresponding redemption chain ID
                if let Some(chain_config) = self.chain_configs.get_chain_config(redemption.abtc_redemption_chain_id.clone()) {
                    // Ensure that the verified_count meets or exceeds the validators_threshold
                    if redemption.verified_count >= chain_config.validators_threshold {
                        log!(
                            "Found valid redemption with txn_hash: {} and verified_count: {} (threshold: {})",
                            txn_hash,
                            redemption.verified_count,
                            chain_config.validators_threshold
                        );
                        return Some(txn_hash.clone()); // Return the first matching txn_hash
                    } 
                } 
            }
        }
    
        None // If no matching redemption is found, return None
    }

    pub fn create_redeem_abtc_transaction(
        &mut self,
        sender: String,
        txn_hashes: Vec<String>,
        utxos: Vec<UtxoInput>, // Passed as mutable to avoid unnecessary clones
        fee_rate: u64,
    ) -> CreatePayloadResult {
        self.assert_admin();
    
        let mut total_required_amount = 0u64;
        let mut txn_hashes_to_process = Vec::new();
        let mut output_count = 0u64;
        let mut total_protocol_fees = 0u64;
        let mut total_receive_amount = 0u64;
        
        // Filter and process redemption transactions in a single loop
        for txn_hash in &txn_hashes {
            
            if let Some(redemption) = self.redemptions.get(txn_hash) {
                if !redemption.abtc_redemption_address.is_empty()
                    && !redemption.abtc_redemption_chain_id.is_empty()
                    && !redemption.btc_receiving_address.is_empty()
                    && redemption.status == RED_BTC_YIELD_PROVIDER_WITHDRAWN
                    && redemption.btc_txn_hash.is_empty()
                    && redemption.remarks.is_empty()
                {
                    if let Some(chain_config) =
                        self.chain_configs.get_chain_config(redemption.abtc_redemption_chain_id.clone())
                    {
                        if redemption.verified_count >= chain_config.validators_threshold {
                            // Calculate amounts before updating redemption
                            let abtc_amount = redemption.abtc_amount;
                            let yield_provider_gas_fee = redemption.yield_provider_gas_fee;
                            let protocol_fee = redemption.protocol_fee;
                            
                            total_required_amount += abtc_amount - yield_provider_gas_fee;
                            output_count += 1;
                            log!("protocol_fee: {}", protocol_fee);
                            total_protocol_fees += protocol_fee;

                            // Update status to pending redemption
                            let mut updated_redemption = redemption.clone();
                            updated_redemption.status = RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER;
                            self.redemptions.insert(txn_hash.clone(), updated_redemption);
                            
                            txn_hashes_to_process.push(txn_hash.clone());
                        }
                    }
                }
            }
        }
    
        if txn_hashes_to_process.is_empty() {
            return CreatePayloadResult {
                psbt: String::new(),
                utxos: vec![],
                estimated_fee: 0,
                protocol_fee: 0,
                receive_amount: 0,
                change: 0,
                txn_hashes: vec![],
            };
        }
    
        // Sort UTXOs in ascending order (smallest first)
        let mut sorted_utxos = utxos.clone();
        sorted_utxos.sort_by(|a, b| a.value.cmp(&b.value));
    
        // Select UTXOs until the total input covers required amount
        let mut selected_utxos = Vec::new();
        let mut total_input = 0u64;
    
        for utxo in &mut sorted_utxos {
            selected_utxos.push(utxo.clone());
            total_input += utxo.value;
    
            if total_input >= total_required_amount {
                break;
            }
        }
    
        if total_input < total_required_amount {
            env::panic_str("Not enough UTXOs to cover the transaction");
        }
    
        // Initialize transaction structure
        let mut unsigned_tx = Transaction {
            version: 2,
            lock_time: 0,
            input: vec![],
            output: vec![],
        };
    
        let calculated_merkle_root = Atlas::calculate_merkle_root(txn_hashes_to_process.clone());

        log!("Created {} merkle leaves from transaction hashes", txn_hashes_to_process.len());

        // Estimate transaction size
        let input_size = (selected_utxos.len() as u64) * 148; // P2PKH input size
        let op_return_size = 32 + 10; // Merkle root (32 bytes) + OP_RETURN overhead
        let output_size = (output_count * 34) + op_return_size; // P2PKH output size
    
        let change_size = if total_input > total_required_amount { 34 } else { 0 };
        let protocol_fee_size = if total_protocol_fees > 0 { 34 } else { 0 };
    
        let tx_size = 10 + input_size + output_size + change_size + protocol_fee_size;
        let estimated_fee = tx_size * fee_rate;
        let average_estimated_fee = estimated_fee / txn_hashes_to_process.len() as u64;
    
        // Add actual outputs with adjusted amounts
        for txn_hash in &txn_hashes_to_process {
            if let Some(redemption) = self.redemptions.get(txn_hash) {
                let receive_amount = redemption.abtc_amount
                    - redemption.yield_provider_gas_fee
                    - redemption.protocol_fee
                    - average_estimated_fee;
    
                    let mut redemption = redemption.clone();
                    redemption.btc_redemption_fee = average_estimated_fee;
                    self.redemptions.insert(txn_hash.clone(), redemption.clone());
                    
                total_receive_amount += receive_amount;
                log!("receipent_address: {}", redemption.btc_receiving_address);
                log!("receive_amount: {}", receive_amount);
                unsigned_tx.output.push(TxOut {
                    value: receive_amount,
                    script_pubkey: Address::from_str(&redemption.btc_receiving_address)
                        .unwrap()
                        .script_pubkey(),
                });
            }
        }
    
        // Add OP_RETURN output with merkle root
        unsigned_tx.output.push(TxOut {
            value: 0,
            script_pubkey: bitcoin::blockdata::script::Builder::new()
                .push_opcode(bitcoin::blockdata::opcodes::all::OP_RETURN)
                .push_slice(calculated_merkle_root.as_bytes()) // Convert String to byte slice
                .into_script(),
        });

        log!("total_input: {}", total_input);
        log!("total_receive_amount: {}", total_receive_amount);
        
        log!("estimated_fee: {}", estimated_fee);   

        let change = total_input - total_receive_amount - total_protocol_fees - estimated_fee;
        log!("Change address: {}", sender);
        log!("change: {}", change);

        if change > 0 {
            unsigned_tx.output.push(TxOut {
                value: change,
                script_pubkey: Address::from_str(&sender).unwrap().script_pubkey(),
            });
        }
        log!("treasury Address: {}", self.global_params.get_treasury_address());    
        log!("total_protocol_fees: {}", total_protocol_fees);
        if total_protocol_fees > 0 {
            let treasury = self.global_params.get_treasury_address();
            unsigned_tx.output.push(TxOut {
                value: total_protocol_fees,
                script_pubkey: Address::from_str(&treasury).unwrap().script_pubkey(),
            });
        }
    
        // Create PSBT
        let psbt = Psbt::from_unsigned_tx(unsigned_tx).expect("Failed to create PSBT");
        let serialized_psbt = serialize(&psbt);
    
        CreatePayloadResult {
            psbt: base64::encode(&serialized_psbt),
            utxos: selected_utxos,
            estimated_fee,
            protocol_fee: total_protocol_fees,
            receive_amount: total_receive_amount,
            change,
            txn_hashes: txn_hashes_to_process,
        }
    }

    pub fn update_redemption_pending_yield_provider_unstake(&mut self, txn_hash: String) {
        self.assert_admin();

        // Validate input parameters
        assert!(
            !txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );

        // Check if the deposit exists for the given btc_txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            log!("Redemption found");
            // Check all specified conditions
            if redemption.status == RED_ABTC_BURNT
                && redemption.remarks.is_empty()
                && redemption.btc_txn_hash.is_empty()
            {
                // All conditions are met, proceed to update the deposit status
                redemption.status = RED_BTC_PENDING_YIELD_PROVIDER_UNSTAKE;
                redemption.timestamp = env::block_timestamp() / 1_000_000_000;
                
                self.redemptions.insert(txn_hash.clone(), redemption);
                log!(
                    "Redemption status updated to RED_BTC_PENDING_YIELD_PROVIDER_UNSTAKE for btc_txn_hash: {}",
                    txn_hash
                );
            } 
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_yield_provider_unstake_processing(&mut self, txn_hash: String) {
        self.assert_admin();
        assert!(
            !txn_hash.is_empty(),
            "transaction hash cannot be empty"
        );

        // Check if the deposit exists for the given btc_txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
          
            // Check all specified conditions
            if redemption.status == RED_BTC_PENDING_YIELD_PROVIDER_UNSTAKE
                && redemption.remarks.is_empty()
                && redemption.btc_txn_hash.is_empty()
            {
                // All conditions are met, proceed to update the deposit status
                redemption.status = RED_BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING;
                self.redemptions.insert(txn_hash.clone(), redemption);
                log!(
                    "Redemption status updated to RED_BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING for btc_txn_hash: {}",
                    txn_hash
                );
            } 
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_yield_provider_unstaked(&mut self, txn_hash: String) {
        self.assert_admin();

        // Validate input parameters
        assert!(
            !txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );

        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            // Check all specified conditions
            if redemption.status == RED_BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING
                && redemption.remarks.is_empty()
                && redemption.btc_txn_hash.is_empty()
            {
                // All conditions are met, proceed to update the redemption status
                redemption.status = RED_BTC_YIELD_PROVIDER_UNSTAKED;
                redemption.timestamp = env::block_timestamp() / 1_000_000_000;
                self.redemptions.insert(txn_hash.clone(), redemption);
                log!(
                    "Redemption status updated to RED_BTC_YIELD_PROVIDER_UNSTAKED for btc_txn_hash: {}",
                    txn_hash
                );
            }
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    // Increments redemption record's verified_count by 1 based on the mempool_redemption record passed in
    // Caller of this function has to be an authorized validator for the particular chain_id of the redemption record
    // Caller of this function has to be a new validator of this txn_hash
    // Checks all fields of mempool_record equal to redemption record
    // Returns true if verified_count incremented successfully and returns false if not incremented
    pub fn increment_redemption_verified_count(
        &mut self,
        mempool_redemption: RedemptionRecord,
    ) -> bool {
        self.assert_not_paused();

        // Validate the mempool_redemption
        if mempool_redemption.txn_hash.is_empty() {
            log!("Invalid mempool_redemption: txn_hash is empty");
            return false;
        }
        
        let caller: AccountId = env::predecessor_account_id();

        // Retrieve the redemption record using the txn_hash
        if let Some(mut redemption) = self.redemptions.get(&mempool_redemption.txn_hash).cloned() {
            let chain_id = redemption.abtc_redemption_chain_id.clone();

            // Use the is_validator function to check if the caller is authorized for the redemption chain ID
            if self.is_validator(&caller, &chain_id) {
                // Retrieve the list of validators for this txn_hash using the getter method
                let mut validators_list =
                    self.get_validators_by_txn_hash(redemption.txn_hash.clone());

                // Check if the caller has already verified this txn_hash
                if validators_list.contains(&caller) {
                    log!(
                        "Caller {} has already verified the transaction with txn_hash: {}.",
                        &caller,
                        &redemption.txn_hash
                    );
                    return false;
                }

                // Verify that all fields of redemption and mempool_redemption are equal
                if redemption.txn_hash != mempool_redemption.txn_hash
                    || redemption.abtc_redemption_address
                        != mempool_redemption.abtc_redemption_address
                    || redemption.abtc_redemption_chain_id
                        != mempool_redemption.abtc_redemption_chain_id
                    || redemption.btc_receiving_address != mempool_redemption.btc_receiving_address
                    || redemption.abtc_amount != mempool_redemption.abtc_amount
                    || redemption.timestamp != mempool_redemption.timestamp
                    || redemption.status != RED_ABTC_BURNT
                    || redemption.remarks != mempool_redemption.remarks
                {
                    log!("Mismatch between near_redemption and mempool_redemption records. Verification failed.");
                    return false;
                }

                // Increment the verified count
                redemption.verified_count += 1;

                // Update the redemption record in the map
                self.redemptions
                    .insert(mempool_redemption.txn_hash.clone(), redemption);

                // Add the caller to the list of validators for this txn_hash
                validators_list.push(caller);
                self.verifications
                    .insert(mempool_redemption.txn_hash, validators_list);

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
                "Redemption record not found for txn_hash: {}.",
                &mempool_redemption.txn_hash
            );
            return false;
        }
    }

    // Increments redemption record's btc_txn_hash_verified_count by 1
    // Caller of this function has to be an authorized validator for the bitcoin chain of the redemption record
    // Caller of this function has to be a new validator of this <txn_hash>,<btc_txn_hash>
    // Checks that redemption record's txn_hash and btc_txn_hash are equal to the input parameters, then increments the btc_txn_hash_verified_count by 1
    // Returns true if btc_txn_hash_verified_count incremented successfully and returns false if not incremented
    pub fn increment_redemption_btc_txn_hash_verified_count(&mut self, txn_hash: String, btc_txn_hash: String) -> bool {
        self.assert_not_paused();

        // Validate input parameters
        if txn_hash.is_empty() || btc_txn_hash.is_empty() {
            log!("Invalid input: txn_hash or btc_txn_hash is empty");
            return false;
        }

        let caller: AccountId = env::predecessor_account_id();

        // Retrieve the redemption record using the txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            let btc_chain_id = if self.is_production_mode() {
                BITCOIN.to_string()
            } else {
                TESTNET4.to_string()
            };

            // Check if the caller is an authorized validator for the bitcoin chain
            if self.is_validator(&caller, &btc_chain_id) {

                // Create a unique key for the verifications map using the COMMA constant
                let verification_key = format!("{}{}{}", txn_hash, COMMA, btc_txn_hash);

                // Retrieve the list of validators for this <txn_hash>,<btc_txn_hash>
                let mut validators_list = self.get_validators_by_txn_hash(verification_key.clone());

                // Check if the caller has already verified this <txn_hash>,<btc_txn_hash>
                if validators_list.contains(&caller) {
                    log!(
                        "Caller {} has already verified the transaction with txn_hash: {} and btc_txn_hash: {}.",
                        &caller,
                        &txn_hash,
                        &btc_txn_hash
                    );
                    return false;
                }

                // Verify that the redemption record's txn_hash and btc_txn_hash match the input parameters
                if redemption.txn_hash == txn_hash && redemption.btc_txn_hash == btc_txn_hash {
                    // Increment the btc_txn_hash_verified_count
                    redemption.btc_txn_hash_verified_count += 1;

                    // Update the redemption record in the map
                    self.redemptions.insert(txn_hash.clone(), redemption);

                    // Add the caller to the list of validators for this <txn_hash>,<btc_txn_hash>
                    validators_list.push(caller);
                    self.verifications.insert(verification_key, validators_list);

                    true // success case returns true
                } else {
                    log!("Mismatch between redemption record and input parameters. Verification failed.");
                    false
                }
            } else {
                log!(
                    "Caller {} is not an authorized validator for the bitcoin chain: {}",
                    &caller,
                    &btc_chain_id
                );
                false
            }
        } else {
            log!(
                "Redemption record not found for txn_hash: {}.",
                &txn_hash
            );
            false
        }
    }

    pub fn verify_redemption_txn_hash_in_merkle_root(&self, merkle_root: String, btc_txn_hash: String, txn_hash_to_verify: String) -> bool {
        // Validate input parameters
        assert!(!merkle_root.is_empty(), "Merkle root cannot be empty");
        assert!(!btc_txn_hash.is_empty(), "BTC transaction hash cannot be empty");
        assert!(!txn_hash_to_verify.is_empty(), "Transaction hash to verify cannot be empty");

        log!("Verifying txn_hash {} in merkle root {} for BTC txn {}", 
            txn_hash_to_verify, merkle_root, btc_txn_hash);

        // Get all redemption records with the given btc_txn_hash
        let txn_hashes: Vec<String> = self.redemptions
            .values()
            .filter(|redemption| redemption.btc_txn_hash == btc_txn_hash)
            .map(|redemption| redemption.txn_hash.clone())
            .collect();

        // If no transactions found with the given btc_txn_hash, return false
        if txn_hashes.is_empty() {
            log!("No redemption records found for BTC txn {}", btc_txn_hash);
            return false;
        }

        log!("Found {} redemption records for BTC txn {}", txn_hashes.len(), btc_txn_hash);

        // Check if txn_hash_to_verify exists in the list
        if !txn_hashes.contains(&txn_hash_to_verify) {
            log!("Transaction hash {} not found in redemption records", txn_hash_to_verify);
            return false;
        }

        log!("Transaction hash {} found in redemption records", txn_hash_to_verify);

        // Calculate merkle root from the transaction hashes
        let calculated_merkle_root = Atlas::calculate_merkle_root(txn_hashes.clone());

        log!("Calculated merkle root: {}", calculated_merkle_root);
        log!("Provided merkle root: {}", merkle_root);

        let result = calculated_merkle_root == merkle_root;
        log!("Merkle root verification result: {}", result);
        
        result
    }
}
