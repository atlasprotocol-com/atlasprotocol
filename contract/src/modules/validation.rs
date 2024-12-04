use near_sdk::{
    AccountId, near_bindgen, env
};
use crate::atlas::Atlas;
use crate::AtlasExt;

#[near_bindgen]
impl Atlas {

    // Getter for validators: Return all chain_ids associated with the account_id that match the given network_type
    pub fn get_chain_ids_by_validator_and_network_type(&self, account_id: AccountId, network_type: String) -> Vec<String> {
        // Validate input parameters
        assert!(!account_id.to_string().is_empty(), "Account ID cannot be empty");
        assert!(!network_type.is_empty(), "Network type cannot be empty");

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
        // Validate input parameters
        assert!(!account_id.to_string().is_empty(), "Account ID cannot be empty");
        assert!(!chain_id.is_empty(), "Chain ID cannot be empty");

        if let Some(chains) = self.validators.get(account_id) {
            chains.contains(chain_id)
        } else {
            false
        }
    }

    // Setter for validators: Add chain_id to the account_id in validators map
    pub fn add_validator(&mut self, account_id: AccountId, chain_id: String) {
        self.assert_not_paused();
        self.assert_owner();

        // Validate input parameters
        assert!(!account_id.to_string().is_empty(), "Account ID cannot be empty");
        assert!(!chain_id.is_empty(), "Chain ID cannot be empty");
        
        let mut chains = self.validators.get(&account_id).cloned().unwrap_or_default();
        if !chains.contains(&chain_id) {
            chains.push(chain_id);
            self.validators.insert(account_id, chains.to_vec());
        }
    }

    // Setter for validators: Remove chain_id from the account_id in validators map
    pub fn remove_validator(&mut self, account_id: AccountId, chain_id: String) {
        self.assert_not_paused();
        self.assert_owner();

        // Validate input parameters
        assert!(!account_id.to_string().is_empty(), "Account ID cannot be empty");
        assert!(!chain_id.is_empty(), "Chain ID cannot be empty");

        if let Some(mut chains) = self.validators.get(&account_id).cloned() {
            if let Some(index) = chains.iter().position(|x| *x == chain_id) {
                chains.remove(index);
                if chains.is_empty() {
                    self.validators.remove(&account_id); // Remove entry if no chains left
                } else {
                    self.validators.insert(account_id, chains);
                }
            } else {
                env::log_str(&format!("Chain ID {} not found for account {}", chain_id, account_id));
            }
        } else {
            env::log_str(&format!("Account {} is not a validator", account_id));
        }
    }

    // Getter method to return the list of validators (AccountId) for a given txn_hash
    pub fn get_validators_by_txn_hash(&self, txn_hash: String) -> Vec<AccountId> {
        // Validate input parameter
        assert!(!txn_hash.is_empty(), "Transaction hash cannot be empty");

        self.verifications.get(&txn_hash).cloned().unwrap_or_else(|| vec![])
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
