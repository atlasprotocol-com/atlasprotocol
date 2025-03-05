use crate::atlas::Atlas;
use crate::chain_configs::ChainConfigRecord;
use crate::global_params::GlobalParams;
use crate::AtlasExt;
use near_sdk::near_bindgen;
use near_sdk::AccountId;
use serde_json::json;
use serde_json::Value;
use near_sdk::{env, log, Promise, NearToken, Gas};
use sha2::{Sha256, Digest};
use crate::constants::delimiter::COMMA;
use crate::constants::near_gas::*;
use crate::constants::network_type::*;
use crate::constants::status::*;

#[near_bindgen]
impl Atlas {
    pub fn is_valid_eth_address(address: String) -> bool {
        if address.len() == 42 && address.starts_with("0x") {
            return hex::decode(&address[2..]).is_ok();
        }
        false
    }

    // Function to get chain config details by chain ID using GlobalParams's get_chain_config function
    pub fn get_chain_config_by_chain_id(&self, chain_id: String) -> Option<ChainConfigRecord> {
        self.chain_configs.get_chain_config(chain_id)
    }

    pub fn get_all_constants(&self) -> Value {
        json!({
            "deposit_status": {
                "DEP_BTC_PENDING_MEMPOOL": DEP_BTC_PENDING_MEMPOOL,
                "DEP_BTC_DEPOSITED_INTO_ATLAS": DEP_BTC_DEPOSITED_INTO_ATLAS,
                "DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT": DEP_BTC_PENDING_YIELD_PROVIDER_DEPOSIT,
                "DEP_BTC_YIELD_PROVIDER_DEPOSITED": DEP_BTC_YIELD_PROVIDER_DEPOSITED,
                "DEP_BTC_PENDING_MINTED_INTO_ABTC": DEP_BTC_PENDING_MINTED_INTO_ABTC,
                "DEP_BTC_MINTED_INTO_ABTC": DEP_BTC_MINTED_INTO_ABTC,
                "DEP_BTC_REFUNDING": DEP_BTC_REFUNDING,
                "DEP_BTC_REFUNDED": DEP_BTC_REFUNDED,
            },
            "redemption_status": {
                "RED_ABTC_BURNT": RED_ABTC_BURNT,
                "RED_BTC_PENDING_YIELD_PROVIDER_UNSTAKE": RED_BTC_PENDING_YIELD_PROVIDER_UNSTAKE,
                "RED_BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING": RED_BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING,
                "RED_BTC_YIELD_PROVIDER_UNSTAKED": RED_BTC_YIELD_PROVIDER_UNSTAKED,
                "RED_BTC_PENDING_YIELD_PROVIDER_WITHDRAW": RED_BTC_PENDING_YIELD_PROVIDER_WITHDRAW,
                "RED_BTC_YIELD_PROVIDER_WITHDRAWING": RED_BTC_YIELD_PROVIDER_WITHDRAWING,
                "RED_BTC_YIELD_PROVIDER_WITHDRAWN": RED_BTC_YIELD_PROVIDER_WITHDRAWN,
                "RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER": RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER,
                "RED_BTC_PENDING_MEMPOOL_CONFIRMATION": RED_BTC_PENDING_MEMPOOL_CONFIRMATION,
                "RED_BTC_REDEEMED_BACK_TO_USER": RED_BTC_REDEEMED_BACK_TO_USER,
            },
            "bridging_status": {
                "BRG_ABTC_PENDING_BURNT": BRG_ABTC_PENDING_BURNT,
                "BRG_ABTC_BURNT": BRG_ABTC_BURNT,
                "BRG_ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST": BRG_ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST,
                "BRG_ABTC_MINTED_TO_DEST": BRG_ABTC_MINTED_TO_DEST,
                "BRG_ABTC_PENDING_YIELD_PROVIDER_UNSTAKE": BRG_ABTC_PENDING_YIELD_PROVIDER_UNSTAKE,
                "BRG_ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING": BRG_ABTC_YIELD_PROVIDER_UNSTAKE_PROCESSING,
                "BRG_ABTC_YIELD_PROVIDER_UNSTAKED": BRG_ABTC_YIELD_PROVIDER_UNSTAKED,
                "BRG_ABTC_PENDING_YIELD_PROVIDER_WITHDRAW": BRG_ABTC_PENDING_YIELD_PROVIDER_WITHDRAW,
                "BRG_ABTC_YIELD_PROVIDER_WITHDRAWING": BRG_ABTC_YIELD_PROVIDER_WITHDRAWING,
                "BRG_ABTC_YIELD_PROVIDER_WITHDRAWN": BRG_ABTC_YIELD_PROVIDER_WITHDRAWN,
                "BRG_ABTC_YIELD_PROVIDER_FEE_SENDING_TO_TREASURY": BRG_ABTC_YIELD_PROVIDER_FEE_SENDING_TO_TREASURY,
                "BRG_ABTC_SENDING_FEE_TO_TREASURY": BRG_ABTC_SENDING_FEE_TO_TREASURY,
                "BRG_ABTC_FEE_SENT_TO_TREASURY": BRG_ABTC_FEE_SENT_TO_TREASURY,
            },
            "network_type": {
                "TESTNET4": TESTNET4,
                "BITCOIN": BITCOIN,
                "SIGNET": SIGNET,
                "EVM": EVM,
                "NEAR": NEAR,
            },
            "delimiter": {
                "COMMA": COMMA,
            },
            "near_gas": {
                "GAS_FOR_STORAGE_DEPOSIT": GAS_FOR_STORAGE_DEPOSIT,
                "MIN_STORAGE_DEPOSIT": MIN_STORAGE_DEPOSIT,
            },
        })
    }

    pub fn get_all_global_params(&self) -> GlobalParams {
        self.global_params.clone()
    }

    pub fn update_fee_deposit_bps(&mut self, fee_deposit_bps: u16) {
        self.assert_not_paused();
        self.global_params.update_fee_deposit_bps(fee_deposit_bps);
    }

    pub fn update_fee_redemption_bps(&mut self, fee_redemption_bps: u16) {
        self.assert_not_paused();
        self.global_params
            .update_fee_redemption_bps(fee_redemption_bps);
    }

    pub fn update_fee_bridging_bps(&mut self, fee_bridging_bps: u16) {
        self.assert_not_paused();
        self.global_params.update_fee_bridging_bps(fee_bridging_bps);
    }

    pub fn update_fee_yield_provider_rewards_bps(&mut self, fee_yield_provider_rewards_bps: u16) {
        self.assert_not_paused();
        self.global_params
            .update_fee_yield_provider_rewards_bps(fee_yield_provider_rewards_bps);
    }

    pub fn update_btc_staking_cap(&mut self, btc_staking_cap: u64) {
        self.assert_not_paused();
        self.global_params.update_btc_staking_cap(btc_staking_cap);
    }

    pub fn update_btc_max_staking_amount(&mut self, btc_max_staking_amount: u64) {
        self.assert_not_paused();
        self.global_params
            .update_btc_max_staking_amount(btc_max_staking_amount);
    }

    pub fn update_btc_min_staking_amount(&mut self, btc_min_staking_amount: u64) {
        self.assert_not_paused();
        self.global_params
            .update_btc_min_staking_amount(btc_min_staking_amount);
    }

    pub fn update_treasury_address(&mut self, treasury_address: String) {
        self.assert_not_paused();
        self.global_params.update_treasury_address(treasury_address);
    }

    pub fn update_max_retry_count(&mut self, max_retry_count: u8) {
        self.assert_not_paused();
        self.global_params.update_max_retry_count(max_retry_count);
    }

    pub fn get_chain_configs_owner_id(&self) -> AccountId {
        self.chain_configs.get_chain_configs_owner_id()
    }

    pub fn get_all_chain_configs(&self) -> Vec<ChainConfigRecord> {
        self.chain_configs.get_chain_configs()
    }

    pub fn get_chain_config(&self, key: String) -> Option<ChainConfigRecord> {
        self.chain_configs.get_chain_config(key)
    }

    pub fn get_chain_configs(&self) -> Vec<ChainConfigRecord> {
        self.chain_configs.get_chain_configs()
    }

    pub fn set_chain_configs_from_json(&mut self, new_json_data: String) {
        self.assert_not_paused();
        self.chain_configs
            .set_chain_configs_from_json(new_json_data);
    }

    pub fn set_mpc_contract(&mut self, new_mpc_contract: AccountId) {
        self.assert_not_paused();
        self.global_params.set_mpc_contract(new_mpc_contract);
    }

    pub fn propose_new_global_params_owner(&mut self, proposed_owner_id: AccountId) {
        self.assert_not_paused();
        self.global_params
            .propose_new_global_params_owner(proposed_owner_id);
    }

    pub fn accept_global_params_owner(&mut self) {
        self.assert_not_paused();
        self.global_params.accept_global_params_owner();
    }

    pub fn propose_new_chain_configs_owner(&mut self, proposed_owner_id: AccountId) {
        self.assert_not_paused();
        self.chain_configs
            .propose_new_chain_configs_owner(proposed_owner_id);
    }

    pub fn accept_chain_configs_owner(&mut self) {
        self.assert_not_paused();
        self.chain_configs.accept_chain_configs_owner();
    }

    pub fn get_last_unstaking_time(&self) -> u64 {
        self.global_params.get_last_unstaking_time()
    }

    pub fn update_last_unstaking_time(&mut self, timestamp: u64) {
        self.assert_admin();
        self.global_params.update_last_unstaking_time(timestamp);
    }

    pub fn create_atlas_signed_payload(
        &mut self,
        payload: Vec<u8>,  // Passing the payload
    ) -> Promise {

        self.assert_admin();

        let caller = env::predecessor_account_id();
        let owner = env::current_account_id();

        log!("Caller: {}", caller);
        log!("Owner: {}", owner);
        
        let args = json!({
            "request": {
                "payload": payload,
                "path": "BITCOIN",
                "key_version": 0
            }
        })
        .to_string()
        .into_bytes();
        
        // Return the promise for the first matching record
        return Promise::new(self.global_params.get_mpc_contract()).function_call(
            "sign".to_owned(),
            args,
            NearToken::from_yoctonear(50),
            Gas::from_tgas(275),
        );


    }

    pub fn calculate_merkle_root(txn_hashes: Vec<String>) -> String {
        // Sort transaction hashes to maintain consistent order
        let mut sorted_hashes = txn_hashes.clone();
        sorted_hashes.sort();

        // Convert transaction hashes to Merkle leaves
        let mut merkle_leaves: Vec<[u8; 32]> = sorted_hashes
            .iter()
            .map(|hash| {
                let mut hasher = Sha256::new();
                hasher.update(hash.as_bytes());
                let result = hasher.finalize();
                let mut array = [0u8; 32];
                array.copy_from_slice(&result);
                array
            })
            .collect();

        // Build the Merkle tree
        while merkle_leaves.len() > 1 {
            let mut next_level = Vec::new();
            for chunk in merkle_leaves.chunks(2) {
                let mut hasher = Sha256::new();
                if chunk.len() == 2 {
                    hasher.update(&chunk[0]);
                    hasher.update(&chunk[1]);
                } else {
                    hasher.update(&chunk[0]);
                    hasher.update(&chunk[0]); // Duplicate last node if odd number
                }
                let result = hasher.finalize();
                let mut array = [0u8; 32];
                array.copy_from_slice(&result);
                next_level.push(array);
            }
            merkle_leaves = next_level;
        }

        // Return the calculated Merkle root as a hexadecimal string
        hex::encode(&merkle_leaves[0])
    }
}
