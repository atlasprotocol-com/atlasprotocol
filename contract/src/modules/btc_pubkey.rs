use crate::atlas::Atlas;
use crate::modules::structs::BtcAddressPubKeyRecord;
use crate::AtlasExt;
use near_sdk::near_bindgen;

#[near_bindgen]
impl Atlas {
    /// Inserts a new BTC address and public key mapping into the system
    /// @param btc_address - The Bitcoin address to map
    /// @param public_key - The public key associated with the BTC address
    /// # Requirements
    /// * Caller must be an admin
    /// * Contract must not be paused
    /// * BTC address must not be empty
    /// * Public key must not be empty
    /// * BTC address must not already exist in the system
    pub fn insert_btc_pubkey(&mut self, btc_address: String, public_key: String) {
        self.assert_not_paused();
        self.assert_admin();

        // Validate input parameters
        assert!(!btc_address.is_empty(), "BTC address cannot be empty.");
        assert!(!public_key.is_empty(), "Public key cannot be empty.");

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

    /// Retrieves the public key associated with a BTC address
    /// @param btc_address - The Bitcoin address to look up
    /// @returns Option<String> - The public key if found, None otherwise
    /// # Requirements
    /// * BTC address must not be empty
    pub fn get_pubkey_by_address(&self, btc_address: String) -> Option<String> {
        // Validate input parameter
        assert!(!btc_address.is_empty(), "BTC address cannot be empty");

        // Get the record and return the public key if found
        self.btc_pubkey
            .get(&btc_address)
            .map(|record| record.public_key.clone())
    }

    /// Retrieves a paginated list of all BTC address and public key mappings
    /// @param from_index - Starting index for pagination
    /// @param limit - Maximum number of records to return (must be between 1 and 1000)
    /// @returns Vec<BtcAddressPubKeyRecord> - A vector of BTC address and public key records
    /// # Requirements
    /// * Limit must be between 1 and 1000
    pub fn get_all_btc_pubkeys(&self, from_index: u64, limit: u64) -> Vec<BtcAddressPubKeyRecord> {
        // Validate input parameters
        assert!(
            limit > 0 && limit <= 1000,
            "Limit must be between 1 and 1000"
        );

        // Calculate the end index
        let total_records = self.btc_pubkey.len() as u64;
        let end_index = std::cmp::min(from_index + limit, total_records);

        // Return empty vector if starting index is beyond total records
        if from_index >= total_records {
            return Vec::new();
        }

        // Collect records within the specified range
        self.btc_pubkey
            .iter()
            .skip(from_index as usize)
            .take((end_index - from_index) as usize)
            .map(|(_, record)| record.clone())
            .collect()
    }

    /// Clears all BTC address and public key mappings from the system
    /// @returns u64 - The number of records that were deleted
    /// # Requirements
    /// * Caller must be the contract owner
    /// * Contract must not be paused
    pub fn clear_all_btc_pubkeys(&mut self) -> u64 {
        // Check admin permissions and contract state
        self.assert_not_paused();
        self.assert_owner();

        // Get the current number of records
        let records_count = self.btc_pubkey.len();

        // Clear all records
        self.btc_pubkey.clear();

        // Return the number of records that were deleted
        records_count as u64
    }
}
