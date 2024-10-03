use near_sdk::{
    near_bindgen, env, log
};
use crate::modules::structs::RedemptionRecord;
use crate::constants::status::*;
use crate::atlas::Atlas;
use crate::AtlasExt;

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
        self.assert_admin();

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
            custody_txn_id: "".to_string()
        };

        self.redemptions.insert(txn_hash, record);
    }

    pub fn get_redemption_by_txn_hash(&self, txn_hash: String) -> Option<RedemptionRecord> {
        self.redemptions.get(&txn_hash).cloned()
    }

    pub fn get_redemptions_by_abtc_redemption_address(&self, abtc_redemption_address: String) -> Vec<RedemptionRecord> {
        self.redemptions
            .values()
            .filter(|record| record.abtc_redemption_address == abtc_redemption_address)
            .cloned()
            .collect()
    }

    pub fn get_redemptions_by_btc_receiving_address(&self, btc_receiving_address: String) -> Vec<RedemptionRecord> {
        self.redemptions
            .values()
            .filter(|record| record.btc_receiving_address == btc_receiving_address)
            .cloned()
            .collect()
    }

    pub fn get_redemptions_by_timestamp(&self, start_time: u64, end_time: u64) -> Vec<RedemptionRecord> {
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

    pub fn update_redemption_timestamp(&mut self, txn_hash: String, timestamp: u64) {
        self.assert_admin();
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            redemption.timestamp = timestamp;
            self.redemptions.insert(txn_hash, redemption);
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_start(&mut self, txn_hash: String) {
        self.assert_admin();
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            redemption.status = RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER;
            self.redemptions.insert(txn_hash, redemption);
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_pending_btc_mempool(&mut self, txn_hash: String, btc_txn_hash: String) {
        self.assert_admin();
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            redemption.status = RED_BTC_PENDING_MEMPOOL_CONFIRMATION;
            redemption.btc_txn_hash = btc_txn_hash;
            self.redemptions.insert(txn_hash, redemption);
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_redeemed(&mut self, txn_hash: String, btc_txn_hash: String, timestamp: u64) {
        self.assert_admin();
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            redemption.status = RED_BTC_REDEEMED_BACK_TO_USER;
            redemption.btc_txn_hash = btc_txn_hash;
            redemption.timestamp = timestamp;
            self.redemptions.insert(txn_hash, redemption);
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_remarks(&mut self, txn_hash: String, remarks: String) {
        self.assert_admin();
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            redemption.remarks = remarks;
            self.redemptions.insert(txn_hash, redemption);
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_custody_txn_id(&mut self, txn_hash: String, custody_txn_id: String) {
        self.assert_admin();
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            redemption.custody_txn_id = custody_txn_id;
            self.redemptions.insert(txn_hash, redemption);
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_redemption_btc_txn_hash(&mut self, txn_hash: String, btc_txn_hash: String) {
        self.assert_admin();
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            redemption.btc_txn_hash = btc_txn_hash;
            self.redemptions.insert(txn_hash, redemption);
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn rollback_redemption_status_by_txn_hash(&mut self, txn_hash: String) {
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
                    },
                    RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER => {
                        redemption.status = RED_ABTC_BURNT;
                        redemption.remarks.clear();
                    },
                    RED_BTC_PENDING_MEMPOOL_CONFIRMATION => {
                        redemption.status = RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER;
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
        // Collect the keys and redemptions that need to be updated
        let updates: Vec<(String, RedemptionRecord)> = self.redemptions.iter()
        .filter_map(|(key, redemption)| {
            let mut redemption = redemption.clone();  // Clone the redemption to modify it
            if !redemption.abtc_redemption_address.is_empty()
                && !redemption.abtc_redemption_chain_id.is_empty()
                && !redemption.btc_receiving_address.is_empty()
                && !redemption.remarks.is_empty() 
            {
                match redemption.status {
                    RED_BTC_PENDING_REDEMPTION_FROM_BABYLON_TO_ATLAS => {
                        redemption.status = RED_ABTC_BURNT;
                        redemption.remarks.clear();
                        Some((key.clone(), redemption))  // Clone the key and return the updated redemption
                    },
                    RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER => {
                        redemption.status = RED_ABTC_BURNT;
                        redemption.remarks.clear();
                        Some((key.clone(), redemption))  // Clone the key and return the updated redemption
                    },
                    RED_BTC_PENDING_MEMPOOL_CONFIRMATION => {
                        redemption.status = RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER;
                        redemption.remarks.clear();
                        Some((key.clone(), redemption))  // Clone the key and return the updated redemption
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

    pub fn clear_all_redemptions(&mut self) {
        self.assert_owner();        
        self.redemptions.clear();
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

    // Increments redemption record's verified_count by 1 based on the mempool_redemption record passed in
    // Caller of this function has to be an authorized validator for the particular chain_id of the redemption record
    // Caller of this function has to be a new validator of this txn_hash
    // Checks all fields of mempool_record equal to redemption record
    // Returns true if verified_count incremented successfully and returns false if not incremented
    pub fn increment_redemption_verified_count(&mut self, mempool_redemption: RedemptionRecord) -> bool {
        let caller = env::predecessor_account_id();

        // Retrieve the redemption record using the txn_hash
        if let Some(mut redemption) = self.redemptions.get(&mempool_redemption.txn_hash).cloned() {
            let chain_id = redemption.abtc_redemption_chain_id.clone();
            
            // Use the is_validator function to check if the caller is authorized for the redemption chain ID
            if self.is_validator(&caller, &chain_id) {
                // Retrieve the list of validators for this txn_hash using the getter method
                let mut validators_list = self.get_validators_by_txn_hash(redemption.txn_hash.clone());

                // Check if the caller has already verified this txn_hash
                if validators_list.contains(&caller) {
                    log!("Caller {} has already verified the transaction with txn_hash: {}.", &caller, &redemption.txn_hash);
                    return false;
                }

                // Verify that all fields of redemption and mempool_redemption are equal
                if redemption.txn_hash != mempool_redemption.txn_hash ||
                    redemption.abtc_redemption_address != mempool_redemption.abtc_redemption_address ||
                    redemption.abtc_redemption_chain_id != mempool_redemption.abtc_redemption_chain_id ||
                    redemption.btc_receiving_address != mempool_redemption.btc_receiving_address ||
                    redemption.abtc_amount != mempool_redemption.abtc_amount ||
                    redemption.timestamp != mempool_redemption.timestamp ||
                    redemption.status != RED_ABTC_BURNT || 
                    redemption.remarks != mempool_redemption.remarks {
                    log!("Mismatch between near_redemption and mempool_redemption records. Verification failed.");
                    return false;
                }

                // Increment the verified count
                redemption.verified_count += 1;

                // Clone redemption before inserting it to avoid moving it
                let cloned_redemption = redemption.clone();

                // Update the redemption record in the map
                self.redemptions.insert(redemption.txn_hash.clone(), cloned_redemption);

                // Add the caller to the list of validators for this txn_hash
                validators_list.push(caller);
                self.verifications.insert(redemption.txn_hash.clone(), validators_list);

                true // success case returns true
            } else {
                log!("Caller {} is not an authorized validator for the chain ID: {}", &caller, &chain_id);
                return false;
            }
        } else {
            log!("Redemption record not found for txn_hash: {}.", &mempool_redemption.txn_hash);
            return false;
        }
    }
   
}
