// src/atlas.rs
use near_sdk::near_bindgen;

pub use crate::modules::signer::*;
pub use crate::modules::structs::*;

#[near_bindgen]
impl Atlas {

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
