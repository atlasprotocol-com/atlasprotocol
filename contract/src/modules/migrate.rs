use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use crate::modules::structs::{BridgingRecord, DepositRecord, RedemptionRecord};
use crate::{Atlas, DepositRecordOld};
use crate::{AtlasExt, BtcAddressPubKeyRecord};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, store::IterableMap, AccountId};

#[derive(BorshDeserialize, BorshSerialize)]
pub struct OldState {
    pub deposits: IterableMap<String, DepositRecordOld>,
    pub redemptions: IterableMap<String, RedemptionRecord>,
    pub bridgings: IterableMap<String, BridgingRecord>,
    pub validators: IterableMap<AccountId, Vec<String>>,
    pub verifications: IterableMap<String, Vec<AccountId>>,
    pub owner_id: AccountId,
    pub proposed_owner_id: Option<AccountId>,
    pub admin_id: AccountId,
    pub proposed_admin_id: Option<AccountId>,
    pub global_params: GlobalParams,
    pub chain_configs: ChainConfigs,
    pub paused: bool,
    pub production_mode: bool,
    pub btc_pubkey: IterableMap<String, BtcAddressPubKeyRecord>,
}

#[near_bindgen]
impl Atlas {
    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        // Try to read the old state
        let old_state: OldState = env::state_read().expect("failed");

        let mut new_deposits: IterableMap<String, DepositRecord> = IterableMap::new(b"d");
        for (_, (tx, deposit)) in old_state.deposits.iter().enumerate() {
            new_deposits.insert(
                tx.to_string(),
                DepositRecord {
                    btc_txn_hash: deposit.btc_txn_hash.to_string(),
                    btc_sender_address: deposit.btc_sender_address.to_string(),
                    receiving_chain_id: deposit.receiving_chain_id.to_string(),
                    receiving_address: deposit.receiving_address.to_string(),
                    btc_amount: deposit.btc_amount,
                    protocol_fee: deposit.protocol_fee,
                    minted_txn_hash: deposit.minted_txn_hash.to_string(),
                    minting_fee: deposit.minting_fee,
                    timestamp: deposit.timestamp,
                    status: deposit.status,
                    remarks: deposit.remarks.to_string(),
                    date_created: deposit.date_created,
                    verified_count: deposit.verified_count,
                    yield_provider_gas_fee: deposit.yield_provider_gas_fee,
                    yield_provider_txn_hash: deposit.yield_provider_txn_hash.to_string(),
                    retry_count: deposit.retry_count,
                    minted_txn_hash_verified_count: deposit.minted_txn_hash_verified_count,
                    refund_txn_id: "".to_string(),
                },
            );
        }

        Self {
            deposits: new_deposits,
            // deposits: old_state.deposits,
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
