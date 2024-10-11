// src/chain_configs.rs

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::store::IterableMap;
use near_sdk::{env, AccountId, PanicOnDefault};
use serde_json;

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
pub struct ChainConfigRecord {
    pub chain_id: String,
    pub network_type: String,
    pub network_name: String,
    pub chain_rpc_url: String,
    pub explorer_url: String,
    pub abtc_address: String,
    pub native_currency_name: String,
    pub native_currency_decimals: u8,
    pub native_currency_symbol: String,
    pub first_block: u64,
    pub batch_size: u64,
    pub gas_limit: u64,
    pub abi_path: String,
    pub validators_threshold: u8,
}

#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
#[borsh(crate = "near_sdk::borsh")]
pub struct ChainConfigs {
    chain_configs: IterableMap<String, ChainConfigRecord>,
    owner_id: AccountId,
}

impl ChainConfigs {
    pub fn init_chain_configs(owner_id: AccountId) -> Self {
        // Validate owner_id
        assert!(!owner_id.to_string().is_empty(), "Owner ID cannot be empty");

        // Log initialization
        env::log_str("Initializing ChainConfigs");

        // Create new instance of IterableMap
        let mut new_chain_configs = IterableMap::new(b"c");

        // Read the JSON configuration from config.json
        let json_data = include_str!("chain_chains.json");
        let config: serde_json::Value =
            serde_json::from_str(&json_data).expect("JSON was not well-formatted");

        // Populate the chain_configs from the JSON
        if let Some(chains) = config.get("chains").and_then(|c| c.as_array()) {
            for chain in chains {
                let chain_record: ChainConfigRecord =
                    serde_json::from_value(chain.clone()).expect("Failed to parse chain record");
                new_chain_configs.insert(chain_record.chain_id.clone(), chain_record);
            }
        }

        // Return the initialized instance
        Self {
            chain_configs: new_chain_configs,
            owner_id,
        }
    }

    fn assert_owner(&self) {
        assert_eq!(self.owner_id, env::predecessor_account_id(), "Only the owner can call this method");
    }

    pub fn get_chain_configs_owner_id(&self) -> AccountId {
        self.owner_id.clone()
    }

    pub fn change_chain_configs_owner_id(&mut self, new_owner_id: AccountId) {
        self.assert_owner();
        
        assert!(!new_owner_id.to_string().is_empty(), "New owner ID cannot be empty");
        assert_ne!(new_owner_id, self.owner_id, "New owner ID must be different from the current owner ID");
        
        let old_owner_id = self.owner_id.clone();
        self.owner_id = new_owner_id.clone();

        env::log_str(&format!("Chain configs owner changed from {} to {}", old_owner_id, new_owner_id));
    }

    pub fn get_chain_config(&self, key: String) -> Option<ChainConfigRecord> {
        // Validate that the key is not empty
        if key.is_empty() {
            env::log_str("Error: Empty key provided for get_chain_config");
            return None;
        }
        self.chain_configs.get(&key).cloned()
    }

    pub fn get_chain_configs(&self) -> Vec<ChainConfigRecord> {
        self.chain_configs.values().cloned().collect()
    }

    // added these functions to delete all chain config records for testing
    pub fn clear_chain_configs(&mut self) {
        self.assert_owner();
        self.chain_configs.clear();
    }

    pub fn set_chain_configs_from_json(&mut self, new_json_data: String) {
        self.assert_owner();
        
        // Clear the current chain_configs
        self.clear_chain_configs();

        // Log resetting action
        env::log_str("Resetting ChainConfigs from provided JSON data");

        // Parse the new JSON data
        let config: serde_json::Value =
            serde_json::from_str(&new_json_data).expect("Invalid JSON data for chain configs");

        // Populate the chain_configs from the parsed JSON
        if let Some(chains) = config.get("chains").and_then(|c| c.as_array()) {
            for chain in chains {
                let chain_record: ChainConfigRecord =
                    serde_json::from_value(chain.clone()).expect("Failed to parse chain record");
                self.chain_configs.insert(chain_record.chain_id.clone(), chain_record);
            }
        }
        env::log_str("Successfully updated ChainConfigs");
    }
}
