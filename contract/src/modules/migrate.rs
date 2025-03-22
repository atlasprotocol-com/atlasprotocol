use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use crate::Atlas;
use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use crate::modules::structs::{DepositRecord, RedemptionRecord, BridgingRecord};
use near_sdk_macros::init;
use crate::AtlasExt;
use near_sdk::{
    env, log, near_bindgen, store::IterableMap, AccountId, Gas, NearToken, Promise, PromiseError,
    PromiseOrValue,
};

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
    pub global_params: GlobalParams,
    pub chain_configs: ChainConfigs,
    pub paused: bool,
    pub production_mode: bool,
}

#[near_bindgen]
impl Atlas {
    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
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
            global_params: old_state.global_params,
            chain_configs: old_state.chain_configs,
            validators: old_state.validators,
            verifications: old_state.verifications, 
            paused: old_state.paused,
            production_mode: old_state.production_mode,
            btc_pubkey: IterableMap::new(b"p"),
        }
    }
} 