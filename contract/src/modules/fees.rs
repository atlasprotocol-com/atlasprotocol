// src/fees.rs
use near_sdk::near_bindgen;
use crate::atlas::Atlas;
use crate::AtlasExt;

#[near_bindgen]
impl Atlas {
    pub fn get_redemption_protocol_fee(&self, amount: u64) -> u64 {
        assert!(amount > 0, "Amount must be greater than zero");
        let redemption_percentage = self.global_params.get_fee_redemption_bps() as u128;
        
        if redemption_percentage == 0 {
            return 0;
        }

        let fee = (amount as u128 * redemption_percentage / 10000) as u64;
        if fee < 650 {
            650
        } else {
            fee
        }
    }

    pub fn get_deposit_protocol_fee(&self, amount: u64) -> u64 {
        assert!(amount > 0, "Amount must be greater than zero");
        let deposit_percentage = self.global_params.get_fee_deposit_bps() as u128;
        
        if deposit_percentage == 0 {
            return 0;
        }

        let fee = (amount as u128 * deposit_percentage / 10000) as u64;
        if fee < 650 {
            650
        } else {
            fee
        }
    }

    pub fn get_bridging_protocol_fee(&self, amount: u64) -> u64 {
        assert!(amount > 0, "Amount must be greater than zero");
        let bridging_percentage = self.global_params.get_fee_bridging_bps() as u128;
        
        if bridging_percentage == 0 {
            return 0;
        }

        let fee = (amount as u128 * bridging_percentage / 10000) as u64;
        if fee < 650 {
            650
        } else {
            fee
        }
    }
}