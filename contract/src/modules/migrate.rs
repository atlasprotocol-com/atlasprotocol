use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use crate::modules::structs::{BridgingRecord, DepositRecord, RedemptionRecord};
use crate::{Atlas, StorageKey};
use crate::{AtlasExt, BtcAddressPubKeyRecord};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::log;
use near_sdk::{borsh::to_vec, env};
use near_sdk::{near_bindgen, store::IterableMap, store::LookupMap, AccountId};

const MIGRATION_BATCH_CURSOR: &[u8] = b"BATCH_CURSOR.v2";

fn state_cursor_read() -> usize {
    env::storage_read(MIGRATION_BATCH_CURSOR)
        .map(|data| usize::try_from_slice(&data).expect("Cannot deserialize the contract state."))
        .unwrap_or(0)
}

pub(crate) fn state_cursor_write(cursor: usize) {
    let data = to_vec(&cursor).expect("Cannot serialize the contract state.");
    env::storage_write(MIGRATION_BATCH_CURSOR, &data);
}

const STATE_V2: &[u8] = b"state.v2";

#[derive(BorshDeserialize, BorshSerialize)]
pub struct V2 {
    pub deposits: IterableMap<String, DepositRecord>,
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
        self.assert_owner();

        if env::storage_has_key(STATE_V2) {
            panic!("Migration already prepared");
        }

        log!("MIGRATION::READING ...");
        let old_state: V2 = env::state_read().expect("Failed to read old state");
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
            Err(_) => env::panic_str("Oops, cannot serialize the contract state."),
        };
        env::storage_write(STATE_V2, &data);
    }

    #[private]
    #[init(ignore_state)]
    pub fn migrate_init() -> Self {
        if !env::storage_has_key(STATE_V2) {
            panic!("call migrate_prepare first");
        }
        state_cursor_write(0);

        let old_state: V2 = env::state_read().expect("Failed to read old state");
        Atlas {
            deposits: old_state.deposits,
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
            atbtc_balances: LookupMap::new(StorageKey::Balances("atbtc_balances".to_string())), // Initialize with an empty LookupMap
        }
    }

    pub fn migrate_deposit(&mut self, size: Option<u64>) {
        self.assert_owner();

        if !env::storage_has_key(STATE_V2) {
            panic!("call migrate_prepare first");
        }

        let old_state = env::storage_read(STATE_V2)
            .map(|data| {
                V2::try_from_slice(&data)
                    .unwrap_or_else(|_| env::panic_str("Cannot deserialize the contract state."))
            })
            .expect("Failed to read v2 state");
        let cursor = state_cursor_read();

        log!("CURSOR --> {}", cursor);
        log!("MIGRATING_DEPOSITS_COUNT --> {}", old_state.deposits.len());

        if cursor >= old_state.deposits.len().try_into().unwrap() {
            state_cursor_write(0);
            log!("DONE");
            return;
        }

        let to_migrate_deposits: Vec<(String, DepositRecord)> = old_state
            .deposits
            .iter()
            .skip(cursor)
            .take(size.unwrap_or(50) as usize)
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect();
        log!("TO_MIGRATE_DEPOSIT_COUNT --> {}", to_migrate_deposits.len());
        for (tx, deposit) in to_migrate_deposits.iter() {
            log!("OLD_DEPOSIT_TX --> {}", tx.clone());

            self.update_balance(
                deposit.receiving_address.clone(),
                deposit.receiving_chain_id.clone(),
                deposit.btc_amount
                    - deposit.minting_fee
                    - deposit.protocol_fee
                    - deposit.yield_provider_gas_fee,
            );
        }

        let new_cursor = cursor + to_migrate_deposits.len();
        state_cursor_write(new_cursor);
    }

    pub fn migrate_redemption(&mut self, size: Option<u64>) {
        self.assert_owner();

        if !env::storage_has_key(STATE_V2) {
            panic!("call migrate_prepare first");
        }

        let old_state = env::storage_read(STATE_V2)
            .map(|data| {
                V2::try_from_slice(&data)
                    .unwrap_or_else(|_| env::panic_str("Cannot deserialize the contract state."))
            })
            .expect("Failed to read v2 state");
        let cursor = state_cursor_read();

        log!("CURSOR --> {}", cursor);
        log!(
            "MIGRATING_REDEMPTIONS_COUNT --> {}",
            old_state.redemptions.len()
        );

        if cursor >= old_state.redemptions.len().try_into().unwrap() {
            state_cursor_write(0);
            log!("DONE");
            return;
        }

        let to_migrate_redemptions: Vec<(String, RedemptionRecord)> = old_state
            .redemptions
            .iter()
            .skip(cursor)
            .take(size.unwrap_or(50) as usize)
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect();
        log!(
            "TO_MIGRATE_REDEMPTION_COUNT --> {}",
            to_migrate_redemptions.len()
        );
        for (tx, redemption) in to_migrate_redemptions.iter() {
            log!("OLD_REDEMPTION_TX --> {}", tx.clone());

            self.update_balance(
                redemption.abtc_redemption_address.clone(),
                redemption.abtc_redemption_chain_id.clone(),
                0 - redemption.abtc_amount,
            );
        }

        let new_cursor = cursor + to_migrate_redemptions.len();
        state_cursor_write(new_cursor);
    }

    pub fn migrate_bridge(&mut self, size: Option<u64>) {
        self.assert_owner();

        if !env::storage_has_key(STATE_V2) {
            panic!("call migrate_prepare first");
        }

        let old_state = env::storage_read(STATE_V2)
            .map(|data| {
                V2::try_from_slice(&data)
                    .unwrap_or_else(|_| env::panic_str("Cannot deserialize the contract state."))
            })
            .expect("Failed to read v2 state");
        let cursor = state_cursor_read();

        log!("CURSOR --> {}", cursor);
        log!("MIGRATING_BRIDGES_COUNT --> {}", old_state.bridgings.len());

        if cursor >= old_state.bridgings.len().try_into().unwrap() {
            state_cursor_write(0);
            log!("DONE");
            return;
        }

        let to_migrate_bridgings: Vec<(String, BridgingRecord)> = old_state
            .bridgings
            .iter()
            .skip(cursor)
            .take(size.unwrap_or(50) as usize)
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect();
        log!(
            "TO_MIGRATE_BRIDGING_COUNT --> {}",
            to_migrate_bridgings.len()
        );
        for (tx, bridging) in to_migrate_bridgings.iter() {
            log!("OLD_BRIDGING_TX --> {}", tx.clone());

            self.update_balance(
                bridging.origin_chain_address.clone(),
                bridging.origin_chain_id.clone(),
                0 - bridging.abtc_amount,
            );

            self.update_balance(
                bridging.dest_chain_address.clone(),
                bridging.dest_chain_id.clone(),
                bridging.abtc_amount
                    - bridging.protocol_fee
                    - bridging.minting_fee_sat
                    - bridging.bridging_gas_fee_sat
                    - bridging.actual_gas_fee_sat
                    - bridging.yield_provider_gas_fee,
            );
        }

        let new_cursor = cursor + to_migrate_bridgings.len();
        state_cursor_write(new_cursor);
    }

    pub fn migrate_cleanup(&mut self) {
        self.assert_owner();

        if env::storage_has_key(STATE_V2) {
            env::storage_remove(STATE_V2);
        }
    }
}
