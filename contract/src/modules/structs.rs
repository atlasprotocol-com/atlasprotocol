use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Serialize};
use near_sdk::near_bindgen;
use near_sdk::PanicOnDefault;
use near_sdk::AccountId;
use near_sdk::store::IterableMap;
use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Atlas {
    pub deposits: IterableMap<String, DepositRecord>,
    pub redemptions: IterableMap<String, RedemptionRecord>,
    pub validators: IterableMap<AccountId, Vec<String>>,       // list of validators: <AccountId -> Vector of authorised chains (chain_id)>
    pub verifications: IterableMap<String, Vec<AccountId>>,    // list of verifications: <Txn Hash of deposit/redemption/bridging -> Vector of validators (AccountId)>
    pub owner_id: AccountId,
    pub admin_id: AccountId,
    pub global_params: GlobalParams,
    pub chain_configs: ChainConfigs,
    pub last_evm_tx: Option<Vec<u8>>,  // Option<Vec<u8>> type 
}

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Clone)]
#[borsh(crate = "near_sdk::borsh")]
pub struct DepositRecord {
    pub btc_txn_hash: String,
    pub btc_sender_address: String,
    pub receiving_chain_id: String,
    pub receiving_address: String,
    pub btc_amount: u64,
    pub minted_txn_hash: String,
    pub timestamp: u64,
    pub status: u8,
    pub remarks: String,
    pub date_created: u64,
    pub verified_count: u8,
}

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Clone)]
#[borsh(crate = "near_sdk::borsh")]
pub struct RedemptionRecord {
    pub txn_hash: String,
    pub abtc_redemption_address: String,
    pub abtc_redemption_chain_id: String,
    pub btc_receiving_address: String,
    pub abtc_amount: u64,
    pub btc_txn_hash: String,
    pub timestamp: u64,
    pub status: u8,
    pub remarks: String,
    pub date_created: u64,
    pub verified_count: u8,
    pub custody_txn_id: String,
}

