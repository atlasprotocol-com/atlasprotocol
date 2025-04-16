use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use crate::modules::structs::{BridgingRecord, DepositRecord, RedemptionRecord};
use crate::{Atlas, DepositRecordOld};
use crate::{AtlasExt, BtcAddressPubKeyRecord};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::log;
use near_sdk::{borsh::to_vec, env};
use near_sdk::{near_bindgen, store::IterableMap, AccountId};

const MIGRATION_BATCH_SIZE: usize = 50;
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

const STATE_V1: &[u8] = b"state.v1";
const DEPOSIT_V2: &[u8] = b"deposit.v2";

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
    pub fn migrate_prepare(&mut self) {
        if env::storage_has_key(STATE_V1) {
            panic!("Migration already prepared");
        }

        let old_state: V1 = env::state_read().expect("Failed to read old state");
        log!("MIGRATION::DEPOSITS --> {}", old_state.deposits.len());
        log!("MIGRATION::REDEMPTIONS --> {}", old_state.redemptions.len());
        log!("MIGRATION::BRIDGINGS --> {}", old_state.bridgings.len());
        log!("MIGRATION::VALIDATORS --> {}", old_state.validators.len());
        log!(
            "MIGRATION::VERIFICATIONS --> {}",
            old_state.verifications.len()
        );

        let data = match borsh::to_vec(&old_state) {
            Ok(serialized) => serialized,
            Err(_) => env::panic_str("Cannot serialize the contract state."),
        };
        env::storage_write(STATE_V1, &data);
    }

    #[private]
    #[init(ignore_state)]
    pub fn migrate_init() -> Self {
        if !env::storage_has_key(STATE_V1) {
            panic!("call migrate_prepare first");
        }
        state_cursor_write(0);

        let old_state: V1 = env::state_read().expect("Failed to read old state");
        Atlas {
            deposits: IterableMap::new(DEPOSIT_V2),
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

    pub fn migrate_process(&mut self) {
        self.assert_owner();

        if !env::storage_has_key(STATE_V1) {
            panic!("call migrate_prepare first");
        }

        let old_state = env::storage_read(STATE_V1)
            .map(|data| {
                V1::try_from_slice(&data)
                    .unwrap_or_else(|_| env::panic_str("Cannot deserialize the contract state."))
            })
            .expect("Failed to read v1 state");
        let cursor = state_cursor_read();

        log!("CURSOR --> {}", cursor);
        log!("DEPOSITS_COUNT --> {}", self.deposits.len());
        log!("MIGRATING_DEPOSITS_COUNT --> {}", old_state.deposits.len());

        if cursor >= old_state.deposits.len().try_into().unwrap() {
            log!("DONE");
            return;
        }

        let to_migrate: Vec<(String, DepositRecordOld)> = old_state
            .deposits
            .iter()
            .skip(cursor)
            .take(MIGRATION_BATCH_SIZE)
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect();
        log!("TO_MIGRATE_COUNT --> {}", to_migrate.len());
        for (tx, old_deposits) in to_migrate.iter() {
            log!("OLD_DEPOSIT_TX --> {}", tx.clone());

            self.deposits.insert(
                tx.clone(),
                DepositRecord {
                    btc_txn_hash: old_deposits.btc_txn_hash.to_string(),
                    btc_sender_address: old_deposits.btc_sender_address.to_string(),
                    receiving_chain_id: old_deposits.receiving_chain_id.to_string(),
                    receiving_address: old_deposits.receiving_address.to_string(),
                    btc_amount: old_deposits.btc_amount,
                    protocol_fee: old_deposits.protocol_fee,
                    minted_txn_hash: old_deposits.minted_txn_hash.to_string(),
                    minting_fee: old_deposits.minting_fee,
                    timestamp: old_deposits.timestamp,
                    status: old_deposits.status,
                    remarks: old_deposits.remarks.to_string(),
                    date_created: old_deposits.date_created,
                    verified_count: old_deposits.verified_count,
                    yield_provider_gas_fee: old_deposits.yield_provider_gas_fee,
                    yield_provider_txn_hash: old_deposits.yield_provider_txn_hash.to_string(),
                    retry_count: 0,
                    minted_txn_hash_verified_count: 0,
                    refund_txn_id: "".to_string(),
                },
            );
        }

        let new_cursor = cursor + to_migrate.len();
        state_cursor_write(new_cursor);
    }

    pub fn migrate_cleanup(&mut self) {
        self.assert_owner();

        if env::storage_has_key(STATE_V1) {
            env::storage_remove(STATE_V1);
        }
    }
}
