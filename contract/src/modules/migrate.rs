use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use crate::modules::structs::{BridgingRecord, DepositRecord, RedemptionRecord};
use crate::{Atlas, DepositRecordOld};
use crate::{AtlasExt, BtcAddressPubKeyRecord};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::{borsh::to_vec, env};
use near_sdk::{near, near_bindgen, store::IterableMap, AccountId};

const VERSION_KEY: &[u8] = b"VERSION";
const DEPOSIT_VERSION: &[u8] = b"v25.04.14";

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
pub struct V2 {
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
    pub fn unsafe_migrate() {
        assert_owner();

        let current_version = state_version_read();
        near_sdk::log!("Migrating from version: {:?}", current_version);

        match current_version {
            StateVersion::V1 => {
                // Perform migration logic from V1 to V2
                let mut old_state: V2 = env::state_read().expect("Failed to read old state");

                let mut new_deposits: IterableMap<String, DepositRecord> =
                    IterableMap::new(DEPOSIT_VERSION);

                for (tx, deposit) in old_state.deposits.iter() {
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

                old_state.deposits.clear();

                let new_state = Self {
                    deposits: new_deposits,
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
                };

                env::state_write(&new_state);
                state_version_write(&StateVersion::V2);
            }
            StateVersion::V2 => {
                near_sdk::log!("Already at the latest version.");
            }
        }
    }
}
