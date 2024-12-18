use crate::atlas::Atlas;
use crate::constants::status::*;
use crate::modules::structs::RedemptionRecord;
use crate::AtlasExt;
use near_sdk::{env, log, near_bindgen, AccountId};

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

        let record = RedemptionRecord {
            txn_hash: txn_hash.clone(),
            abtc_redemption_address,
            abtc_redemption_chain_id,
            btc_receiving_address,
            abtc_amount,
            btc_txn_hash: "".to_string(),
            timestamp,
            status: RED_ABTC_BURNT,
            remarks: "".to_string(),
            date_created,
            verified_count: 0,
            custody_txn_id: "".to_string(),
        };

        self.redemptions.insert(txn_hash, record);
    }

    pub fn get_redemption_by_txn_hash(&self, txn_hash: String) -> Option<RedemptionRecord> {
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");

        self.redemptions.get(&txn_hash).cloned()
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

    pub fn update_redemption_start(&mut self, txn_hash: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");

        // Retrieve the redemption record based on txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            // Fetch chain configuration for the redemption's chain_id
            if let Some(chain_config) = self
                .chain_configs
                .get_chain_config(redemption.abtc_redemption_chain_id.clone())
            {
                // Check all specified conditions
                if redemption.status == RED_ABTC_BURNT
                    && redemption.verified_count >= chain_config.validators_threshold
                    && redemption.remarks.is_empty()
                    && redemption.btc_txn_hash.is_empty()
                {
                    // All conditions are met, proceed to update the redemption status
                    redemption.status = RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER;
                    self.redemptions.insert(txn_hash.clone(), redemption);
                    log!("Redemption status updated to RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER for txn_hash: {}", txn_hash);
                } else {
                    // Log a message if conditions are not met
                    log!(
                        "Conditions not met for updating redemption start for txn_hash: {}. 
                         Status: {}, Verified count: {}, Remarks: {}, BTC txn hash: {}",
                        txn_hash,
                        redemption.status,
                        redemption.verified_count,
                        redemption.remarks,
                        redemption.btc_txn_hash
                    );
                }
            } else {
                env::panic_str("Chain configuration not found for redemption chain ID");
            }
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_pending_btc_mempool(
        &mut self,
        txn_hash: String,
        btc_txn_hash: String,
    ) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );

        // Retrieve the redemption record based on txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            // Fetch chain configuration for the redemption's chain_id
            if let Some(chain_config) = self
                .chain_configs
                .get_chain_config(redemption.abtc_redemption_chain_id.clone())
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
                         Status: {}, Verified count: {}, Remarks: {}, BTC txn hash: {}",
                        txn_hash,
                        redemption.status,
                        redemption.verified_count,
                        redemption.remarks,
                        redemption.btc_txn_hash
                    );
                }
            } else {
                env::panic_str("Chain configuration not found for redemption chain ID");
            }
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_redeemed(
        &mut self,
        txn_hash: String,
        btc_txn_hash: String,
        timestamp: u64,
    ) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");
        assert!(
            !btc_txn_hash.is_empty(),
            "BTC transaction hash cannot be empty"
        );
        assert!(timestamp != 0, "Timestamp cannot be zero");

        // Retrieve the redemption record based on txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            // Fetch chain configuration for the redemption's chain ID
            if let Some(chain_config) = self
                .chain_configs
                .get_chain_config(redemption.abtc_redemption_chain_id.clone())
            {
                // Check all specified conditions
                if (redemption.status == RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER
                    || redemption.status == RED_BTC_PENDING_MEMPOOL_CONFIRMATION)
                    && redemption.verified_count >= chain_config.validators_threshold
                    && redemption.remarks.is_empty()
                {
                    // All conditions are met, proceed to update the redemption status
                    redemption.status = RED_BTC_REDEEMED_BACK_TO_USER;
                    redemption.btc_txn_hash = btc_txn_hash;
                    redemption.timestamp = timestamp;
                    self.redemptions.insert(txn_hash.clone(), redemption);
                    log!("Redemption status updated to RED_BTC_REDEEMED_BACK_TO_USER for txn_hash: {}", txn_hash);
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

    pub fn update_redemption_custody_txn_id(&mut self, txn_hash: String, custody_txn_id: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");
        assert!(
            !custody_txn_id.is_empty(),
            "Custody transaction ID cannot be empty"
        );

        // Retrieve the redemption record based on txn_hash
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            // Fetch chain configuration for the redemption's chain ID
            if let Some(chain_config) = self
                .chain_configs
                .get_chain_config(redemption.abtc_redemption_chain_id.clone())
            {
                // Check all specified conditions
                if redemption.status == RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER
                    && redemption.remarks.is_empty()
                    && redemption.verified_count >= chain_config.validators_threshold
                    && redemption.btc_txn_hash.is_empty()
                {
                    // All conditions are met, proceed to update the custody_txn_id
                    redemption.custody_txn_id = custody_txn_id;
                    self.redemptions.insert(txn_hash.clone(), redemption);
                    log!("Custody transaction ID updated for txn_hash: {}", txn_hash);
                } else {
                    // Log a message if conditions are not met
                    log!(
                        "Conditions not met for updating custody transaction ID for txn_hash: {}. 
                         Status: {}, Verified count: {}, Remarks: {}, BTC txn hash: {}",
                        txn_hash,
                        redemption.status,
                        redemption.verified_count,
                        redemption.remarks,
                        redemption.btc_txn_hash
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
                && !redemption.remarks.is_empty()
            {
                match redemption.status {
                    RED_BTC_PENDING_REDEMPTION_FROM_BABYLON_TO_ATLAS => {
                        redemption.status = RED_ABTC_BURNT;
                        redemption.remarks.clear();
                    }
                    RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER => {
                        redemption.status = RED_ABTC_BURNT;
                        redemption.remarks.clear();
                    }
                    RED_BTC_PENDING_MEMPOOL_CONFIRMATION => {
                        redemption.status = RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER;
                        redemption.remarks.clear();
                    }
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
                        RED_BTC_PENDING_REDEMPTION_FROM_BABYLON_TO_ATLAS => {
                            redemption.status = RED_ABTC_BURNT;
                            redemption.remarks.clear();
                            Some((key.clone(), redemption)) // Clone the key and return the updated redemption
                        }
                        RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER => {
                            redemption.status = RED_ABTC_BURNT;
                            redemption.remarks.clear();
                            Some((key.clone(), redemption)) // Clone the key and return the updated redemption
                        }
                        RED_BTC_PENDING_MEMPOOL_CONFIRMATION => {
                            redemption.status = RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER;
                            redemption.remarks.clear();
                            Some((key.clone(), redemption)) // Clone the key and return the updated redemption
                        }
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

    pub fn get_first_valid_redemption(&self) -> Option<String> {
        for (txn_hash, redemption) in self.redemptions.iter() {
            // Ensure basic redemption criteria
            if redemption.btc_receiving_address != ""
                && redemption.status == RED_ABTC_BURNT
                && redemption.remarks == ""
                && redemption.btc_txn_hash == ""
            {
                // Fetch the chain configuration for the corresponding redemption chain ID
                if let Some(chain_config) = self
                    .chain_configs
                    .get_chain_config(redemption.abtc_redemption_chain_id.clone())
                {
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

        let caller: AccountId = env::predecessor_account_id();

        // Validate the mempool_redemption
        if mempool_redemption.txn_hash.is_empty() {
            log!("Invalid mempool_redemption: txn_hash is empty");
            return false;
        }

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
}
