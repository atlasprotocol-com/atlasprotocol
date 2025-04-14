use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use crate::modules::structs::{BridgingRecord, DepositRecord, RedemptionRecord};
use crate::{Atlas, DepositRecordOld};
use crate::{AtlasExt, BtcAddressPubKeyRecord};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::{borsh::to_vec, env};
use near_sdk::{near, near_bindgen, store::IterableMap, AccountId};

const MIGRATION_BATCH_SIZE: usize = 30;
const VERSION_KEY: &[u8] = b"VERSION";
const ATLAS_VERSION: &[u8] = b"v25.04.14";
const ATLAS_VERSION_DEPOSITS: &[u8] = b"v25.04.14_deposits";

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
                let mut new_state: Atlas = env::storage_read(ATLAS_VERSION)
                    .map(|data| {
                        Atlas::try_from_slice(&data).unwrap_or_else(|_| {
                            env::panic_str("Cannot deserialize the contract state.")
                        })
                    })
                    .unwrap_or(Atlas {
                        deposits: IterableMap::new(ATLAS_VERSION_DEPOSITS.to_vec()),
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
                    });

                let keys = old_state.deposits.keys().take(MIGRATION_BATCH_SIZE);
                let size: usize = keys.len();

                if size > 0 {
                    for key in keys {
                        let deposit = old_state.deposits.get(key).expect("Failed to get deposit");

                        new_state.deposits.insert(
                            key.to_string(),
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
                                yield_provider_txn_hash: deposit
                                    .yield_provider_txn_hash
                                    .to_string(),
                                retry_count: deposit.retry_count,
                                minted_txn_hash_verified_count: deposit
                                    .minted_txn_hash_verified_count,
                                refund_txn_id: "".to_string(),
                            },
                        );

                        new_state.deposits.remove(key);
                    }
                }

                let new_state_data = match borsh::to_vec(&new_state) {
                    Ok(serialized) => serialized,
                    Err(_) => env::panic_str("Cannot serialize the contract state."),
                };

                if size < MIGRATION_BATCH_SIZE {
                    env::state_write(&new_state_data);
                    state_version_write(&StateVersion::V2);
                } else {
                    env::storage_write(ATLAS_VERSION, &new_state_data);
                }
            }
            StateVersion::V2 => {
                near_sdk::log!("Already at the latest version.");
            }
        }
    }
}
