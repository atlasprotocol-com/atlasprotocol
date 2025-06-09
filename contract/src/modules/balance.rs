use crate::atlas::Atlas;
use crate::AtlasExt;
use near_sdk::near_bindgen;

#[near_bindgen]
impl Atlas {
    pub fn get_atbtc_balance_keys(&self, address: String) -> Vec<String> {
        self.chain_configs
            .get_chain_configs()
            .iter()
            .map(|chain_config| format!("{}:{}", address, chain_config.chain_id))
            .collect()
    }

    pub fn update_balance(&mut self, address: String, chain_id: String, balance: u64) {
        let key = format!("{}:{}", address, chain_id);

        if let Some(current_balance) = self.atbtc_balances.get(&key) {
            self.atbtc_balances.insert(key, current_balance + balance);
        } else {
            self.atbtc_balances.insert(key, balance);
        }
    }

    pub fn get_balance(&self, address: String) -> Vec<(String, u64)> {
        let keys = self.get_atbtc_balance_keys(address.clone());
        let mut result = Vec::new();

        for key in keys {
            let balance = self.atbtc_balances.get(&key).cloned().unwrap_or(0);
            result.push((key, balance));
        }

        result
    }
}
