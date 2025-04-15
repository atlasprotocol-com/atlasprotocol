use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use crate::modules::structs::{BridgingRecord, DepositRecord, RedemptionRecord};
use crate::{Atlas, DepositRecordOld};
use crate::{AtlasExt, BtcAddressPubKeyRecord};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::log;
use near_sdk::{borsh::to_vec, env};
use near_sdk::{near, near_bindgen, store::IterableMap, AccountId};

const MIGRATION_BATCH_SIZE: usize = 30;
const MIGRATION_BATCH_CUSOR: &[u8] = b"BATCH_CUSOR";

fn state_cursor_read() -> usize {
    env::storage_read(MIGRATION_BATCH_CUSOR)
        .map(|data| usize::try_from_slice(&data).expect("Cannot deserialize the contract state."))
        .unwrap_or(0)
}

pub(crate) fn state_cursor_write(cursor: usize) {
    let data = to_vec(&cursor).expect("Cannot serialize the contract state.");
    env::storage_write(MIGRATION_BATCH_CUSOR, &data);
}

const V2_DEPOSIT: &[u8] = b"V2_DEPOSIT";

#[derive(BorshDeserialize, BorshSerialize)]
pub struct V1 {
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
    pub fn migrate_init() -> Self {
        let old_state: V1 = env::state_read().expect("Failed to read old state");
        Atlas {
            deposits: IterableMap::new(V2_DEPOSIT),
            redemptions: old_state.redemptions,
            bridgings: old_state.bridgings,
            validators: old_state.validators,
            verifications: old_state.verifications,
            owner_id: old_state.owner_id,
            proposed_owner_id: old_state.proposed_owner_id,
            admin_id: old_state.admin_id,
            proposed_admin_id: old_state.proposed_admin_id,
            global_params: old_state.global_params,
            chain_configs: old_state.chain_configs,
            paused: old_state.paused,
            production_mode: old_state.production_mode,
            btc_pubkey: old_state.btc_pubkey,
        }
    }

    pub fn migrate_check(&mut self) {
        let old_state: V1 = env::state_read().expect("Failed to read old state");
        log!("old_state.deposits: {}", old_state.deposits.len());
        log!("self.deposits: {}", self.deposits.len());
    }

    // pub fn migrate(&mut self) {
    //     self.assert_owner();

    //     // Perform migration logic from V1 to V2
    //     let old_state: V1 = env::state_read().expect("Failed to read old state");
    //     let cursor = state_cursor_read();
    //     log!("DEPOSITS_COUNT --> {}", self.deposits.len());
    //     log!("CUROSR --> {}", cursor);

    //     let to_migrate: Vec<(String, DepositRecordOld)> = old_state
    //         .deposits
    //         .iter()
    //         .skip(cursor)
    //         .take(MIGRATION_BATCH_SIZE)
    //         .map(|(k, v)| (k.to_string(), v.clone()))
    //         .collect();

    //     for (tx, old_deposits) in to_migrate.iter() {
    //         log!("OLD_DEPOSIT_TX --> {}", tx.clone());

    //         self.deposits.insert(
    //             tx.clone(),
    //             DepositRecord {
    //                 btc_txn_hash: old_deposits.btc_txn_hash.to_string(),
    //                 btc_sender_address: old_deposits.btc_sender_address.to_string(),
    //                 receiving_chain_id: old_deposits.receiving_chain_id.to_string(),
    //                 receiving_address: old_deposits.receiving_address.to_string(),
    //                 btc_amount: old_deposits.btc_amount,
    //                 protocol_fee: old_deposits.protocol_fee,
    //                 minted_txn_hash: old_deposits.minted_txn_hash.to_string(),
    //                 minting_fee: old_deposits.minting_fee,
    //                 timestamp: old_deposits.timestamp,
    //                 status: old_deposits.status,
    //                 remarks: old_deposits.remarks.to_string(),
    //                 date_created: old_deposits.date_created,
    //                 verified_count: old_deposits.verified_count,
    //                 yield_provider_gas_fee: old_deposits.yield_provider_gas_fee,
    //                 yield_provider_txn_hash: old_deposits.yield_provider_txn_hash.to_string(),
    //                 retry_count: 0,
    //                 minted_txn_hash_verified_count: 0,
    //                 refund_txn_id: "".to_string(),
    //             },
    //         );
    //     }

    //     let new_cursor = cursor + to_migrate.len();
    //     if new_cursor < MIGRATION_BATCH_SIZE {
    //         state_cursor_write(0);
    //     } else {
    //         state_cursor_write(new_cursor);
    //     }
    // }
}
