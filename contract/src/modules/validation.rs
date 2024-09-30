use near_sdk::{
    AccountId, near_bindgen, env, log
};
use crate::atlas::Atlas;
use crate::AtlasExt;
use crate::constants::status::*;
use crate::constants::delimiter::COMMA;
use crate::constants::network_type::SIGNET;
use crate::modules::structs::BridgingRecord;
use crate::modules::structs::RedemptionRecord;
use crate::modules::structs::DepositRecord;

#[near_bindgen]
impl Atlas {

    // Getter for validators: Return all chain_ids associated with the account_id that match the given network_type
    pub fn get_chain_ids_by_validator_and_network_type(&self, account_id: AccountId, network_type: String) -> Vec<String> {
        if let Some(chain_ids) = self.validators.get(&account_id) {
            chain_ids
                .iter()
                .filter_map(|chain_id| {
                    // Get the chain config for this chain_id
                    if let Some(chain_config) = self.chain_configs.get_chain_config(chain_id.clone()) {
                        // Check if the network_type matches the provided network_type
                        if chain_config.network_type == network_type {
                            return Some(chain_id.clone());
                        }
                    }
                    None
                })
                .collect()
        } else {
            Vec::new() // If no validators are found for this account, return an empty vector
        }
    }

    // Getter for validators: Check if a specific chain_id is associated with the account_id
    // Returns true if is an authorised validator, returns false if not a validator for this chain_id
    pub fn is_validator(&self, account_id: &AccountId, chain_id: &String) -> bool {
        if let Some(chains) = self.validators.get(account_id) {
            chains.contains(chain_id)
        } else {
            false
        }
    }

    // Setter for validators: Add chain_id to the account_id in validators map
    pub fn add_validator(&mut self, account_id: AccountId, chain_id: String) {
        self.assert_owner();
        let mut chains = self.validators.get(&account_id).cloned().unwrap_or_default();
        if !chains.contains(&chain_id) {
            chains.push(chain_id);
            self.validators.insert(account_id, chains.to_vec());
        }
    }

    // Setter for validators: Remove chain_id from the account_id in validators map
    pub fn remove_validator(&mut self, account_id: AccountId, chain_id: String) {
        self.assert_owner();
        if let Some(mut chains) = self.validators.get(&account_id).cloned() {
            if let Some(index) = chains.iter().position(|x| *x == chain_id) {
                chains.remove(index);
                if chains.is_empty() {
                    self.validators.remove(&account_id); // Remove entry if no chains left
                } else {
                    self.validators.insert(account_id, chains);
                }
            }
        }
    }

    // Getter method to return the list of validators (AccountId) for a given txn_hash
    pub fn get_validators_by_txn_hash(&self, txn_hash: String) -> Vec<AccountId> {
        self.verifications.get(&txn_hash).cloned().unwrap_or_else(|| vec![])
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

    // Increments deposit record's verified_count by 1 based on the mempool_deposit record passed in
    // Caller of this function has to be an authorised validator for the particular chain_id of the redemption record
    // Caller of this function has to be a new validator of this btc_txn_hash
    // Checks all fields of mempool_record equal to deposit record
    // Returns true if verified_count incremented successfully and returns false if not incremented
    pub fn increment_deposit_verified_count(&mut self, mempool_deposit: DepositRecord) -> bool {
        let caller = env::predecessor_account_id();
    
        // Retrieve the deposit record using the btc_txn_hash
        if let Some(mut deposit) = self.deposits.get(&mempool_deposit.btc_txn_hash).cloned() {
            let chain_id = SIGNET.to_string();
            
            // Use the is_validator function to check if the caller is authorized for the bitcoin deposit
            if self.is_validator(&caller, &chain_id) {
                // Retrieve the list of validators for this btc_txn_hash using the getter method
                let mut validators_list = self.get_validators_by_txn_hash(deposit.btc_txn_hash.clone());
                
                // Check if the caller has already verified this btc_txn_hash
                if validators_list.contains(&caller) {
                    log!("Caller {} has already verified the transaction with btc_txn_hash: {}.", &caller, &deposit.btc_txn_hash);
                    return false;
                }
    
                // Verify that all fields of deposit and mempool_deposit are equal
                if deposit.btc_txn_hash != mempool_deposit.btc_txn_hash ||
                    deposit.btc_sender_address != mempool_deposit.btc_sender_address ||
                    deposit.receiving_chain_id != mempool_deposit.receiving_chain_id ||
                    deposit.receiving_address != mempool_deposit.receiving_address ||
                    deposit.btc_amount != mempool_deposit.btc_amount ||
                    deposit.timestamp != mempool_deposit.timestamp ||
                    deposit.status != DEP_BTC_DEPOSITED_INTO_ATLAS ||
                    deposit.remarks != mempool_deposit.remarks {
                    log!("Mismatch between near_deposit and mempool_deposit records. Verification failed.");
                    return false;
                }
    
                // Increment the verified count
                deposit.verified_count += 1;
    
                // Clone deposit before inserting it to avoid moving it
                let cloned_deposit = deposit.clone();

                // Update the deposit record in the map
                self.deposits.insert(deposit.btc_txn_hash.clone(), cloned_deposit);
        
                // Add the caller to the list of validators for this btc_txn_hash
                validators_list.push(caller);
                self.verifications.insert(deposit.btc_txn_hash.clone(), validators_list);
    
                true // success case returns true
            } else {
                log!("Caller {} is not an authorized validator for the chain ID: {}", &caller, &chain_id);
                return false;
            }
        } else {
            log!("Deposit record not found for btc_txn_hash: {}.", &mempool_deposit.btc_txn_hash);
            return false;
        }
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
            log!("Invalid bridging record's txn_hash format: {}", mempool_bridging.txn_hash);
            return false;
        }
    
        //let origin_txn_hash = mempool_bridging_txn_hash[0];
        let origin_chain_id = mempool_bridging_txn_hash[1].to_string();
    
        // Retrieve the bridging record using the txn_hash
        if let Some(mut bridging) = self.bridgings.get(&mempool_bridging.txn_hash).cloned() {
            // Check if the origin_chain_id matches
            if bridging.origin_chain_id != origin_chain_id {
                log!("Bridging record's Chain ID mismatch: expected {}, found {}", bridging.origin_chain_id, origin_chain_id);
                return false;
            }
    
            // Use the is_validator function to check if the caller is authorized for the origin chain ID
            if self.is_validator(&caller, &origin_chain_id) {
                // Retrieve the list of validators for this txn_hash using the getter method
                let mut validators_list = self.get_validators_by_txn_hash(bridging.txn_hash.clone());
    
                // Check if the caller has already verified this txn_hash
                if validators_list.contains(&caller) {
                    log!("Caller {} has already verified the transaction with txn_hash: {}.", &caller, &bridging.txn_hash);
                    return false;
                }
    
                // Verify that all fields of bridging and mempool_bridging are equal
                if bridging.txn_hash != mempool_bridging.txn_hash ||
                   bridging.origin_chain_id != mempool_bridging.origin_chain_id ||
                   bridging.origin_chain_address != mempool_bridging.origin_chain_address ||
                   bridging.dest_chain_id != mempool_bridging.dest_chain_id ||
                   bridging.dest_chain_address != mempool_bridging.dest_chain_address ||
                   bridging.abtc_amount != mempool_bridging.abtc_amount ||
                   bridging.timestamp != mempool_bridging.timestamp ||
                   bridging.status != mempool_bridging.status || 
                   bridging.remarks != mempool_bridging.remarks {
                    log!("Mismatch between near_bridging and mempool_bridging records. Verification failed.");
                    return false;
                }
    
                // Increment the verified count
                bridging.verified_count += 1;
    
                // Clone bridging before inserting it to avoid moving it
                let cloned_bridging = bridging.clone();
    
                // Update the bridging record in the map
                self.bridgings.insert(bridging.txn_hash.clone(), cloned_bridging);
    
                // Add the caller to the list of validators for this txn_hash
                validators_list.push(caller);
                self.verifications.insert(bridging.txn_hash.clone(), validators_list);
    
                true // success case returns true
            } else {
                log!("Caller {} is not an authorized validator for the chain ID: {}", &caller, &origin_chain_id);
                return false;
            }
        } else {
            log!("Bridging record not found for txn_hash: {}.", &mempool_bridging.txn_hash);
            return false;
        }
    }

    pub fn get_all_validators(&self) -> Vec<(AccountId, Vec<String>)> {
        self.validators
            .iter()
            .map(|(account_id, chains)| (account_id.clone(), chains.clone()))
            .collect()
    }    

    pub fn get_all_verifications(&self) -> Vec<(String, Vec<AccountId>)> {
        self.verifications
            .iter()
            .map(|(txn_hash, account_ids)| (txn_hash.clone(), account_ids.clone()))
            .collect()
    }    
}
