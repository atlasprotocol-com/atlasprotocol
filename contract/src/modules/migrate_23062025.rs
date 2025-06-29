use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use crate::Atlas;
use crate::chain_configs::ChainConfigs;
use crate::global_params::{GlobalParams};
use crate::modules::structs::{BtcAddressPubKeyRecord, DepositRecord, RedemptionRecord, BridgingRecord};
use near_sdk_macros::init;
use crate::AtlasExt;
use near_sdk::{
    env, log, near_bindgen, store::IterableMap, AccountId, Gas, NearToken, Promise, PromiseError,
    PromiseOrValue,
};
use serde::{Deserialize, Serialize};

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Clone)]
pub struct OldGlobalParams {
    pub mpc_contract: AccountId,
    pub fee_deposit_bps: u16,
    pub fee_redemption_bps: u16,
    pub fee_bridging_bps: u16,
    pub fee_yield_provider_rewards_bps: u16,
    pub btc_staking_cap: u64,
    pub btc_max_staking_amount: u64,
    pub btc_min_staking_amount: u64,
    pub treasury_address: String,
    pub owner_id: AccountId,
    pub proposed_owner_id: Option<AccountId>,
    pub max_retry_count: u8,
    pub last_unstaking_time: u64,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct OldState  {
    pub deposits: IterableMap<String, DepositRecord>,
    pub redemptions: IterableMap<String, RedemptionRecord>,
    pub bridgings: IterableMap<String, BridgingRecord>,
    pub validators: IterableMap<AccountId, Vec<String>>, // list of validators: <AccountId -> Vector of authorised chains (chain_id)>
    pub verifications: IterableMap<String, Vec<AccountId>>, // list of verifications: <Txn Hash of deposit/redemption/bridging -> Vector of validators (AccountId)>
    pub owner_id: AccountId,
    pub proposed_owner_id: Option<AccountId>,
    pub admin_id: AccountId,
    pub proposed_admin_id: Option<AccountId>,
    pub global_params: OldGlobalParams,
    pub chain_configs: ChainConfigs,
    pub paused: bool,
    pub production_mode: bool,
    pub btc_pubkey: IterableMap<String, BtcAddressPubKeyRecord>,
    pub atbtc_balances: IterableMap<String, u64>,
}

#[near_bindgen]
impl Atlas {
    #[private]
    #[init(ignore_state)]
    pub fn migrate_23062005() -> Self {
        // Try to read the old state
        let old_state: OldState = env::state_read().expect("failed");
        
        Self {
            deposits: old_state.deposits,
            redemptions: old_state.redemptions,
            bridgings: old_state.bridgings,
            owner_id: old_state.owner_id,
            proposed_owner_id: old_state.proposed_owner_id, 
            admin_id: old_state.admin_id,
            proposed_admin_id: old_state.proposed_admin_id,
            global_params: Self::new_from_old(old_state.global_params),
            chain_configs: old_state.chain_configs,
            validators: old_state.validators,
            verifications: old_state.verifications, 
            paused: old_state.paused,
            production_mode: old_state.production_mode,
            btc_pubkey: old_state.btc_pubkey,
            atbtc_balances: old_state.atbtc_balances,
        }
    }

    #[private]
    pub fn new_from_old(old_params: OldGlobalParams) -> GlobalParams {
        GlobalParams {
            mpc_contract: old_params.mpc_contract,
            fee_deposit_bps: old_params.fee_deposit_bps,
            fee_redemption_bps: old_params.fee_redemption_bps,
            fee_bridging_bps: old_params.fee_bridging_bps,
            fee_yield_provider_rewards_bps: old_params.fee_yield_provider_rewards_bps,
            btc_staking_cap: old_params.btc_staking_cap,
            btc_max_staking_amount: old_params.btc_max_staking_amount,
            btc_min_staking_amount: old_params.btc_min_staking_amount,
            treasury_address: old_params.treasury_address,
            owner_id: old_params.owner_id,
            proposed_owner_id: old_params.proposed_owner_id,
            max_retry_count: old_params.max_retry_count,
            last_unstaking_time: old_params.last_unstaking_time,
            atbtc_min_redemption_amount: 10000,
            atbtc_min_bridging_amount: 10000,
        }
    }
}