// src/atlas.rs
use near_sdk::near_bindgen;
use near_sdk::env;
pub use crate::modules::signer::*;
pub use crate::modules::structs::*;

#[near_bindgen]
impl Atlas {
    // added these functions to update deposit, redemption and bridging status for testing
    pub fn update_bridging_status(&mut self, txn_hash: String, status: u8) {
        self.assert_admin();
        if let Some(mut bridging) = self.bridgings.get(&txn_hash).cloned() {
            bridging.status = status;
            self.bridgings.insert(txn_hash, bridging);
        } else {
            env::panic_str("Bridging record not found");
        }
    }

    pub fn update_redemption_status(&mut self, txn_hash: String, status: u8) {
        self.assert_admin();
        if let Some(mut redemption) = self.redemptions.get(&txn_hash).cloned() {
            redemption.status = status;
            self.redemptions.insert(txn_hash, redemption);
        } else {
            env::panic_str("Redemption record not found");
        }
    }

    pub fn update_deposit_status(&mut self, btc_txn_hash: String, status: u8) {
        self.assert_admin();
        if let Some(mut deposit) = self.deposits.get(&btc_txn_hash).cloned() {
            deposit.status = status;
            self.deposits.insert(btc_txn_hash, deposit);
        } else {
            env::panic_str("Deposit record not found");
        }
    }

    // added these functions to delete all deposit, redemption and bridging records for testing
    pub fn clear_all_deposits(&mut self) {
        self.assert_owner();
        self.deposits.clear();
    }

    pub fn clear_all_redemptions(&mut self) {
        self.assert_owner();
        self.redemptions.clear();
    }

    pub fn clear_all_bridgings(&mut self) {
        self.assert_owner();
        self.bridgings.clear();
    }

    pub fn clear_all_validators(&mut self) {
        self.assert_owner();
        self.validators.clear();
    }

    pub fn clear_all_verifications(&mut self) {
        self.assert_owner();
        self.verifications.clear();
    }

    pub fn clear_all_chain_configs(&mut self) {
        self.assert_owner();
        self.chain_configs.clear_chain_configs();
    }
}
