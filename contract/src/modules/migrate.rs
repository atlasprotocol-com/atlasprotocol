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
const VERSION_KEY: &[u8] = b"VERSION";

#[near]
#[derive(Debug)]
pub(crate) enum StateVersion {
    V1,
    V2,
}

fn state_version_read() -> StateVersion {
    env::storage_read(VERSION_KEY)
        .map(|data| {
            StateVersion::try_from_slice(&data).expect("Cannot deserialize the contract state.")
        })
        .unwrap_or(StateVersion::V1) // Default to V1 if no version is stored.
}

pub(crate) fn state_version_write(version: &StateVersion) {
    let data = to_vec(&version).expect("Cannot serialize the contract state.");
    env::storage_write(VERSION_KEY, &data);
    near_sdk::log!("Migrated to version: {:?}", version);
}

fn state_cursor_read() -> usize {
    env::storage_read(MIGRATION_BATCH_CUSOR)
        .map(|data| usize::try_from_slice(&data).expect("Cannot deserialize the contract state."))
        .unwrap_or(0)
}

pub(crate) fn state_cursor_write(cursor: usize) {
    let data = to_vec(&cursor).expect("Cannot serialize the contract state.");
    env::storage_write(MIGRATION_BATCH_CUSOR, &data);
}

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
    pub fn unsafe_migrate(&mut self) {
        self.assert_owner();

        let current_version = state_version_read();
        near_sdk::log!("Migrating from version: {:?}", current_version);

        match current_version {
            StateVersion::V1 => {
                // Perform migration logic from V1 to V2
                let old_state: V1 = env::state_read().expect("Failed to read old state");
                let cursor = state_cursor_read();
                log!("DEPOSITS_COUNT --> {}", self.deposits.len());
                log!("CUROSR --> {}", cursor);

                let to_migrate: Vec<(String, DepositRecordOld)> = old_state
                    .deposits
                    .iter()
                    .skip(cursor)
                    .take(MIGRATION_BATCH_SIZE)
                    .map(|(k, v)| (k.to_string(), v.clone()))
                    .collect();
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
                            yield_provider_txn_hash: old_deposits
                                .yield_provider_txn_hash
                                .to_string(),
                            retry_count: 0,
                            minted_txn_hash_verified_count: 0,
                            refund_txn_id: "".to_string(),
                        },
                    );
                }

                let new_cursor = cursor + to_migrate.len();
                if new_cursor < MIGRATION_BATCH_SIZE {
                    state_version_write(&StateVersion::V2);
                    state_cursor_write(0);
                } else {
                    state_cursor_write(new_cursor);
                }
            }
            StateVersion::V2 => {
                near_sdk::log!("Already at the latest version.");
            }
        }
    }
}
