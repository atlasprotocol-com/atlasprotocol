use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use crate::modules::structs::{BridgingRecord, DepositRecord, RedemptionRecord};
use crate::Atlas;
use crate::{AtlasExt, BtcAddressPubKeyRecord};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::log;
use near_sdk::{borsh::to_vec, env};
use near_sdk::{near_bindgen, store::IterableMap, AccountId};

fn state_cursor_read(key: String) -> usize {
    env::storage_read(key.as_bytes())
        .map(|data| usize::try_from_slice(&data).expect("Unable to read cursor"))
        .unwrap_or(0)
}

pub(crate) fn state_cursor_write(key: String, cursor: usize) {
    let data = to_vec(&cursor).expect("Unable to write cursor");
    env::storage_write(key.as_bytes(), &data);
}

const PREVIOUS_STATE: &[u8] = b"state";
const ATBTC_BALANCES: &[u8] = b"atbtc_balances";

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
    pub atbtc_balances: IterableMap<String, u64>,
}

#[near_bindgen]
impl Atlas {
    #[private]
    #[init(ignore_state)]
    pub fn migrate_init() -> Self {
        let old_state: V2 = env::state_read().expect("Failed to read old state");

        let data = match borsh::to_vec(&old_state) {
            Ok(serialized) => serialized,
            Err(err) => env::panic_str(&format!("Serialization error: {:?}", err)),
        };
        env::storage_write(PREVIOUS_STATE, &data);

        state_cursor_write("migrate.deposits".to_string(), 0);
        state_cursor_write("migrate.redemptions".to_string(), 0);
        state_cursor_write("migrate.bridgings".to_string(), 0);

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
            atbtc_balances: IterableMap::new(ATBTC_BALANCES),
        }
    }

    pub fn migrate_deposit(&mut self, size: Option<u64>) {
        self.assert_owner();

        if !env::storage_has_key(PREVIOUS_STATE) {
            panic!("call migrate_prepare first");
        }

        let old_state = env::storage_read(PREVIOUS_STATE)
            .map(|data| {
                V2::try_from_slice(&data)
                    .unwrap_or_else(|_| env::panic_str("Cannot deserialize the contract state."))
            })
            .expect("Failed to read v2 state");
        let cursor = state_cursor_read("migrate.deposits".to_string());

        log!("CURSOR --> {}", cursor);
        log!("MIGRATING_DEPOSITS_COUNT --> {}", old_state.deposits.len());

        if cursor >= old_state.deposits.len().try_into().unwrap() {
            state_cursor_write("migrate.deposits".to_string(), 0);
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
            let amount = deposit.btc_amount - deposit.minting_fee - deposit.protocol_fee;
            let new_balance = self.increase_balance(deposit.receiving_chain_id.clone(), amount);

            log!(
                "DEPOSIT_CHANGE --> {} -> {} -> {}",
                tx.clone(),
                amount,
                new_balance
            );
        }

        let new_cursor = cursor + to_migrate_deposits.len();
        state_cursor_write("migrate.deposits".to_string(), new_cursor);
    }

    pub fn migrate_redemption(&mut self, size: Option<u64>) {
        self.assert_owner();

        if !env::storage_has_key(PREVIOUS_STATE) {
            panic!("call migrate_prepare first");
        }

        let old_state = env::storage_read(PREVIOUS_STATE)
            .map(|data| {
                V2::try_from_slice(&data)
                    .unwrap_or_else(|_| env::panic_str("Cannot deserialize the contract state."))
            })
            .expect("Failed to read v2 state");
        let cursor = state_cursor_read("migrate.redemptions".to_string());

        log!("CURSOR --> {}", cursor);
        log!(
            "MIGRATING_REDEMPTIONS_COUNT --> {}",
            old_state.redemptions.len()
        );

        if cursor >= old_state.redemptions.len().try_into().unwrap() {
            state_cursor_write("migrate.redemptions".to_string(), 0);
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
        for (_, redemption) in to_migrate_redemptions.iter() {
            // Use checked_sub to avoid overflow, and negate if possible, else use 0
            let amount = redemption.abtc_amount;
            let new_balance =
                self.decrease_balance(redemption.abtc_redemption_chain_id.clone(), amount);

            log!(
                "REDEMPTION_CHANGE --> {} -> {} -> {}",
                redemption.txn_hash.clone(),
                amount,
                new_balance
            );
        }

        let new_cursor = cursor + to_migrate_redemptions.len();
        state_cursor_write("migrate.redemptions".to_string(), new_cursor);
    }

    pub fn migrate_bridge(&mut self, size: Option<u64>) {
        self.assert_owner();

        if !env::storage_has_key(PREVIOUS_STATE) {
            panic!("call migrate_prepare first");
        }

        let old_state = env::storage_read(PREVIOUS_STATE)
            .map(|data| {
                V2::try_from_slice(&data)
                    .unwrap_or_else(|_| env::panic_str("Cannot deserialize the contract state."))
            })
            .expect("Failed to read v2 state");
        let cursor = state_cursor_read("migrate.bridgings".to_string());

        log!("CURSOR --> {}", cursor);
        log!("MIGRATING_BRIDGES_COUNT --> {}", old_state.bridgings.len());

        if cursor >= old_state.bridgings.len().try_into().unwrap() {
            state_cursor_write("migrate.bridgings".to_string(), 0);
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
            let origin_amount = bridging.abtc_amount;
            let new_balance_origin =
                self.decrease_balance(bridging.origin_chain_id.clone(), origin_amount);

            log!(
                "BRIDGE -> {} --> {} -> {} -> {}",
                tx.clone(),
                bridging.origin_chain_id.clone(),
                origin_amount.clone(),
                new_balance_origin
            );

            let dest_amount = bridging.abtc_amount
                - bridging.minting_fee_sat
                - bridging.protocol_fee
                - bridging.bridging_gas_fee_sat
                - bridging.actual_gas_fee_sat;
            let dest_new_balance =
                self.increase_balance(bridging.dest_chain_id.clone(), dest_amount);

            log!(
                "BRIDGE -> {} --> {} -> {} -> {}",
                tx.clone(),
                bridging.dest_chain_id.clone(),
                dest_amount.clone(),
                dest_new_balance
            );
        }

        let new_cursor = cursor + to_migrate_bridgings.len();
        state_cursor_write("migrate.bridgings".to_string(), new_cursor);
    }

    pub fn migrate_cleanup(&mut self) {
        self.assert_owner();

        if env::storage_has_key(PREVIOUS_STATE) {
            env::storage_remove(PREVIOUS_STATE);
        }
    }
}
