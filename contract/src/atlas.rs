// src/atlas.rs
use near_sdk::near_bindgen;

pub use crate::modules::signer::*;
pub use crate::modules::structs::*;

#[near_bindgen]
impl Atlas {

    // added these functions to delete all deposit, redemption and bridging records for testing
    pub fn clear_all_deposits(&mut self) {
        self.assert_owner();
        self.deposits.clear();
    }

    pub fn clear_all_redemptions(&mut self) {
        self.assert_owner();
        self.redemptions.clear();
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
