// src/global_params.rs

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::{env, AccountId, PanicOnDefault};
use serde::{Deserialize, Serialize};

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, PanicOnDefault, Clone)]
pub struct GlobalParams {
    mpc_contract: AccountId,
    fee_deposit_bps: u16,
    fee_redemption_bps: u16,
    fee_bridging_bps: u16,
    fee_babylon_rewards_bps: u16,
    btc_staking_cap: u64,
    btc_max_staking_amount: u64,
    btc_min_staking_amount: u64,
    treasury_address: String,    
    owner_id: AccountId,
}

impl GlobalParams {

    pub fn init_global_params(owner_id: AccountId, treasury_address: String) -> Self {        
        
        // Create the new instance of the struct
        env::log_str("Initializing GlobalParams");
        Self {
            mpc_contract: "v1.signer-prod.testnet".to_string().parse().unwrap(),
            fee_deposit_bps: 0,
            fee_redemption_bps: 0,
            fee_bridging_bps: 0,
            fee_babylon_rewards_bps: 0,
            btc_staking_cap: 50000000000,
            btc_max_staking_amount: 5000000,
            btc_min_staking_amount: 2000,
            treasury_address: treasury_address,            
            owner_id: owner_id,
        }
    }

    fn assert_owner(&self) {
        assert_eq!(self.owner_id, env::predecessor_account_id(), "Only the owner can call this method");
    }

    pub fn get_global_params_owner_id(&self) -> AccountId {
        self.owner_id.clone()
    }
    
    pub fn change_global_param_owner_id(&mut self, new_owner_id: AccountId) {
        self.assert_owner();
        self.owner_id = new_owner_id;
    }

    // Getter and Setter methods
    pub fn get_mpc_contract(&self) -> AccountId {
        self.mpc_contract.clone()
    }
    
    pub fn set_mpc_contract(&mut self, new_mpc_contract: AccountId) {
        self.assert_owner();
        self.mpc_contract = new_mpc_contract;
    }

    pub fn get_fee_deposit_bps(&self) -> u16 {
        self.fee_deposit_bps
    }

    pub fn get_fee_redemption_bps(&self) -> u16 {
        self.fee_redemption_bps
    }

    pub fn get_fee_bridging_bps(&self) -> u16 {
        self.fee_bridging_bps
    }

    pub fn get_fee_babylon_rewards_bps(&self) -> u16 {
        self.fee_babylon_rewards_bps
    }

    pub fn get_btc_staking_cap(&self) -> u64 {
        self.btc_staking_cap
    }

    pub fn get_btc_max_staking_amount(&self) -> u64 {
        self.btc_max_staking_amount
    }

    pub fn get_btc_min_staking_amount(&self) -> u64 {
        self.btc_min_staking_amount
    }

    pub fn get_treasury_address(&self) -> String {
        self.treasury_address.clone()
    }

    pub fn update_fee_deposit_bps(&mut self, fee_deposit_bps: u16) {
        self.assert_owner();
        assert!(fee_deposit_bps <= 10000, "Deposit fee bps must be between 0 and 10000");
        self.fee_deposit_bps = fee_deposit_bps;
    }

    pub fn update_fee_redemption_bps(&mut self, fee_redemption_bps: u16) {
        self.assert_owner();
        assert!(fee_redemption_bps <= 10000, "Redemption fee bps must be between 0 and 10000");
        self.fee_redemption_bps = fee_redemption_bps;
    }

    pub fn update_fee_bridging_bps(&mut self, fee_bridging_bps: u16) {
        self.assert_owner();
        assert!(fee_bridging_bps <= 10000, "Bridging fee bps must be between 0 and 10000");
        self.fee_bridging_bps = fee_bridging_bps;
    }

    pub fn update_fee_babylon_rewards_bps(&mut self, fee_babylon_rewards_bps: u16) {
        self.assert_owner();
        assert!(fee_babylon_rewards_bps <= 10000, "Babylon Rewards fee bps must be between 0 and 10000");
        self.fee_babylon_rewards_bps = fee_babylon_rewards_bps;
    }

    pub fn update_btc_staking_cap(&mut self, btc_staking_cap: u64) {
        self.assert_owner();
        self.btc_staking_cap = btc_staking_cap;
    }

    pub fn update_btc_max_staking_amount(&mut self, btc_max_staking_amount: u64) {
        self.assert_owner();
        self.btc_max_staking_amount = btc_max_staking_amount;
    }

    pub fn update_btc_min_staking_amount(&mut self, btc_min_staking_amount: u64) {
        self.assert_owner();
        self.btc_min_staking_amount = btc_min_staking_amount;
    }

    pub fn update_treasury_address(&mut self, treasury_address: String) {
        self.assert_owner();
        assert!(!treasury_address.is_empty(), "Treasury address cannot be empty");
        self.treasury_address = treasury_address;
    }
}
