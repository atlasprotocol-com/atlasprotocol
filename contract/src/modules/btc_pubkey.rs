use crate::atlas::Atlas;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::near_bindgen;
use near_sdk::store::IterableMap;
use near_sdk::AccountId;
use near_sdk::PanicOnDefault;
use crate::AtlasExt;
use crate::modules::structs::BtcAddressPubKeyRecord;

#[near_bindgen]
impl Atlas {

    pub fn insert_btc_pubkey(&mut self, btc_address: String, public_key: String) {

        self.assert_not_paused();
        self.assert_admin();
        
        // Validate input parameters
        assert!(!btc_address.is_empty(), "BTC address cannot be empty");
        assert!(!public_key.is_empty(), "Public key cannot be empty");

        // Check if the BTC address already exists
        if self.btc_pubkey.contains_key(&btc_address) {
            near_sdk::env::panic_str("BTC address already exists");
        }

        let record = BtcAddressPubKeyRecord {
            btc_address: btc_address.clone(),
            public_key,
        };

        self.btc_pubkey.insert(btc_address, record);
    }

    pub fn get_pubkey_by_address(&self, btc_address: String) -> Option<String> {
        // Validate input parameter
        assert!(!btc_address.is_empty(), "BTC address cannot be empty");

        // Get the record and return the public key if found
        self.btc_pubkey
            .get(&btc_address)
            .map(|record| record.public_key.clone())
    }
} 