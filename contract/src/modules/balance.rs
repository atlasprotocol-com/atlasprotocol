use crate::atlas::Atlas;
use crate::AtlasExt;
use near_sdk::near_bindgen;

#[near_bindgen]
impl Atlas {
    pub fn increase_balance(&mut self, chain_id: String, balance: u64) {
        let key = format!("{}", chain_id);

        if let Some(current_balance) = self.atbtc_balances.get(&key) {
            self.atbtc_balances.insert(key, current_balance + balance);
        } else {
            self.atbtc_balances.insert(key, balance);
        }
    }

    pub fn decrease_balance(&mut self, chain_id: String, balance: u64) {
        let key = format!("{}", chain_id);

        if let Some(current_balance) = self.atbtc_balances.get(&key) {
            self.atbtc_balances.insert(key, current_balance - balance);
        } else {
            self.atbtc_balances.insert(key, balance);
        }
    }

    pub fn get_balance(&self, chain_id: String) -> u64 {
        return self.atbtc_balances.get(&chain_id).cloned().unwrap_or(0);
    }
}
