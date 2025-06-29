use crate::atlas::Atlas;
use crate::AtlasExt;
use near_sdk::{log, near_bindgen};

#[near_bindgen]
impl Atlas {
    pub fn increase_balance(&mut self, chain_id: String, changes: u64) -> u64 {
        let key = format!("{}", chain_id);

        log!("BALANCE_CHANGE: {} -> {}", chain_id.clone(), changes);

        if let Some(current_balance) = self.atbtc_balances.get(&key) {
            let balance = current_balance + changes;
            self.atbtc_balances.insert(key, balance.clone());
            return balance;
        } else {
            self.atbtc_balances.insert(key, changes.clone());
            return changes;
        }
    }

    pub fn decrease_balance(&mut self, chain_id: String, changes: u64) -> u64 {
        let key = format!("{}", chain_id);

        log!("BALANCE_CHANGE: {} -> -{}", chain_id.clone(), changes);

        if let Some(current_balance) = self.atbtc_balances.get(&key) {
            let balance = current_balance - changes;
            self.atbtc_balances.insert(key, balance.clone());
            return balance;
        } else {
            self.atbtc_balances.insert(key, changes.clone());
            return changes;
        }
    }

    pub fn get_balance(&self, chain_id: String) -> u64 {
        return self.atbtc_balances.get(&chain_id).cloned().unwrap_or(0);
    }

    pub fn get_balances(&self) -> Vec<(String, u64)> {
        self.atbtc_balances
            .iter()
            .map(|(k, v)| (k.clone(), *v))
            .collect()
    }
}
