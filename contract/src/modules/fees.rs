// src/fees.rs
use near_sdk::near_bindgen;
use crate::atlas::Atlas;
use crate::AtlasExt;

#[near_bindgen]
impl Atlas {
    pub fn get_redemption_tax_amount(&self, amount: u64) -> u64 {
        let redemption_percentage = self.global_params.get_fee_redemption_bps() as u64 / 10000; // Redemption fee

        // Calculate tax using redemption_percentage
        (amount * redemption_percentage) / 100
    }

    pub fn get_deposit_tax_amount(&self, amount: u64) -> u64 {
        let deposit_percentage = self.global_params.get_fee_deposit_bps() as u64 / 10000; // Redemption fee

        // Calculate tax using redemption_percentage
        (amount * deposit_percentage) / 100
    }

    pub fn get_bridging_tax_amount(&self, amount: u64) -> u64 {
        let bridging_percentage = self.global_params.get_fee_bridging_bps() as u64 / 10000; // Redemption fee

        // Calculate tax using redemption_percentage
        (amount * bridging_percentage) / 100
    }
}