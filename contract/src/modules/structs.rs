use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::near_bindgen;
use near_sdk::store::IterableMap;
use near_sdk::AccountId;
use near_sdk::PanicOnDefault;
use serde::{Deserialize, Serialize};

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Atlas {
    pub deposits: IterableMap<String, DepositRecord>,
    pub redemptions: IterableMap<String, RedemptionRecord>,
    pub validators: IterableMap<AccountId, Vec<String>>, // list of validators: <AccountId -> Vector of authorised chains (chain_id)>
    pub verifications: IterableMap<String, Vec<AccountId>>, // list of verifications: <Txn Hash of deposit/redemption/bridging -> Vector of validators (AccountId)>
    pub owner_id: AccountId,
    pub proposed_owner_id: Option<AccountId>,
    pub admin_id: AccountId,
    pub proposed_admin_id: Option<AccountId>,
    pub global_params: GlobalParams,
    pub chain_configs: ChainConfigs,
    pub last_evm_tx: Option<Vec<u8>>,
    pub paused: bool,
    pub production_mode: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Clone)]
#[borsh(crate = "near_sdk::borsh")]
pub struct DepositRecord {
    pub btc_txn_hash: String,
    pub btc_sender_address: String,
    pub receiving_chain_id: String,
    pub receiving_address: String,
    pub btc_amount: u64,
    pub fee_amount: u64,
    pub minted_txn_hash: String,
    pub timestamp: u64,
    pub status: u8,
    pub remarks: String,
    pub date_created: u64,
    pub verified_count: u8,
    pub retry_count: u8,
    pub minted_txn_hash_verified_count: u8,
    pub custody_txn_id: String,
}

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Clone)]
#[borsh(crate = "near_sdk::borsh")]
pub struct RedemptionRecord {
    pub txn_hash: String,                   //`${chain.chainID}${DELIMITER.COMMA}${transactionHash}`
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
    pub btc_txn_hash_verified_count: u8,
    pub custody_txn_id: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UtxoInput {
    pub txid: String,
    pub vout: u32,
    pub value: u64,
    pub script: String,
}

#[derive(Serialize, Deserialize)]
pub struct UtxoOutput {
    pub address: String,
    pub value: u64,
}

#[derive(Serialize, Deserialize)]
pub struct WithDrawFailDepositResult {
    pub btc_txn_hash: String,
    pub psbt: String,
    pub utxos: Vec<UtxoInput>,
    pub estimated_fee: u64,
    pub receive_amount: u64,
    pub change: u64,
}
