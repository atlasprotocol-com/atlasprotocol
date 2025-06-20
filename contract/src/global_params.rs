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
    fee_yield_provider_rewards_bps: u16,
    btc_staking_cap: u64,
    btc_max_staking_amount: u64,
    btc_min_staking_amount: u64,
    treasury_address: String,
    owner_id: AccountId,
    proposed_owner_id: Option<AccountId>, // Proposed owner for two-step ownership transfer
    max_retry_count: u8,
    last_unstaking_time: u64, // Timestamp of the last unstaking operation
}

impl GlobalParams {
    pub fn init_global_params(owner_id: AccountId, treasury_address: String) -> Self {
        // Validate inputs
        assert!(
            !owner_id.to_string().is_empty(),
            "Global params owner ID cannot be empty"
        );
        assert!(
            !treasury_address.is_empty(),
            "Treasury address cannot be empty"
        );

        env::log_str("Initializing GlobalParams");
        Self {
            mpc_contract: "v1.signer-prod.testnet".to_string().parse().unwrap(),
            fee_deposit_bps: 0,
            fee_redemption_bps: 0,
            fee_bridging_bps: 0,
            fee_yield_provider_rewards_bps: 0,
            btc_staking_cap: 50000000000,
            btc_max_staking_amount: 100000000,
            btc_min_staking_amount: 20000,
            treasury_address: treasury_address,
            owner_id: owner_id,
            proposed_owner_id: None,
            max_retry_count: 3,
            last_unstaking_time: 0, // Initialize with 0 timestamp
        }
    }

    fn assert_owner(&self) {
        assert_eq!(
            self.owner_id,
            env::predecessor_account_id(),
            "Only the owner can call this method"
        );
    }

    pub fn propose_new_global_params_owner(&mut self, proposed_owner_id: AccountId) {
        self.assert_owner();

        assert!(
            !proposed_owner_id.to_string().is_empty(),
            "Proposed global params owner ID cannot be empty"
        );
        assert_ne!(
            proposed_owner_id, self.owner_id,
            "Proposed global params owner ID must be different from the current global params owner ID"
        );

        self.proposed_owner_id = Some(proposed_owner_id.clone());
        env::log_str(&format!(
            "Proposed new global params owner: {}",
            proposed_owner_id
        ));
    }

    pub fn accept_global_params_owner(&mut self) {
        let caller = env::predecessor_account_id();

        // Ensure there is a proposed owner
        if self.proposed_owner_id.is_none() {
            env::panic_str("No proposed global params owner to accept ownership");
        }

        // Ensure the caller is the proposed owner
        let proposed_owner = self.proposed_owner_id.clone().unwrap();
        if proposed_owner != caller {
            env::panic_str("Only the proposed global params owner can accept ownership");
        }

        // Transfer ownership
        let old_owner = self.owner_id.clone();
        self.owner_id = caller;
        self.proposed_owner_id = None;

        env::log_str(&format!(
            "Global params ownership transferred from {} to {}.",
            old_owner, self.owner_id
        ));
    }

    // Getter and Setter methods
    pub fn get_mpc_contract(&self) -> AccountId {
        self.mpc_contract.clone()
    }

    pub fn get_treasury_address(&self) -> String {
        self.treasury_address.clone()
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

    pub fn get_fee_yield_provider_rewards_bps(&self) -> u16 {
        self.fee_yield_provider_rewards_bps
    }

    pub fn set_mpc_contract(&mut self, new_mpc_contract: AccountId) {
        self.assert_owner();
        assert!(
            !new_mpc_contract.to_string().is_empty(),
            "Invalid MPC contract ID"
        );
        assert_ne!(
            new_mpc_contract, self.mpc_contract,
            "New MPC contract must be different from the current one"
        );

        let old_mpc_contract = self.mpc_contract.clone();
        self.mpc_contract = new_mpc_contract.clone();

        env::log_str(&format!(
            "MPC contract changed from {} to {}",
            old_mpc_contract, new_mpc_contract
        ));
    }

    pub fn update_fee_deposit_bps(&mut self, fee_deposit_bps: u16) {
        self.assert_owner();
        // setting max fee to 3%
        assert!(
            fee_deposit_bps <= 300,
            "Invalid fee: must be between 0 and 300 basis points"
        );
        self.fee_deposit_bps = fee_deposit_bps;
    }

    pub fn update_fee_redemption_bps(&mut self, fee_redemption_bps: u16) {
        self.assert_owner();
        // setting max fee to 3%
        assert!(
            fee_redemption_bps <= 300,
            "Invalid fee: must be between 0 and 300 basis points"
        );
        self.fee_redemption_bps = fee_redemption_bps;
    }

    pub fn update_fee_bridging_bps(&mut self, fee_bridging_bps: u16) {
        self.assert_owner();
        // setting max fee to 3%
        assert!(
            fee_bridging_bps <= 300,
            "Invalid fee: must be between 0 and 300 basis points"
        );
        self.fee_bridging_bps = fee_bridging_bps;
    }

    pub fn update_fee_yield_provider_rewards_bps(&mut self, fee_yield_provider_rewards_bps: u16) {
        self.assert_owner();
        // setting max fee to 10%
        assert!(
            fee_yield_provider_rewards_bps <= 1000,
            "Invalid fee: must be between 0 and 1000 basis points"
        );
        self.fee_yield_provider_rewards_bps = fee_yield_provider_rewards_bps;
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
        assert!(!treasury_address.is_empty(), "Invalid treasury address");
        self.treasury_address = treasury_address;
    }

    pub fn update_max_retry_count(&mut self, max_retry_count: u8) {
        self.assert_owner();
        assert!(
            max_retry_count > 0,
            "Max retry count must be greater than ZERO"
        );
        self.max_retry_count = max_retry_count;
    }

    pub fn owner_id(&self) -> &AccountId {
        &self.owner_id
    }
}
