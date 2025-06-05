use crate::atlas::Atlas;
use crate::{AtBTCBalance, AtlasExt, StorageKey};
use near_sdk::near_bindgen;
use near_sdk::store::Vector;

#[near_bindgen]
impl Atlas {
    pub fn update_balance(&mut self, address: String, chain_id: String, balance: u64) {
        let key = format!("{}:{}", address, chain_id);
        let atbtc_balance = AtBTCBalance {
            chain_id: chain_id.clone(),
            balance,
        };

        if let Some(balances) = self.atbtc_balances.get(&address) {
            let mut balances_clone = Vector::new(StorageKey::Balance { key });
            for bal in balances.iter() {
                balances_clone.push(bal.clone());
            }
            let mut balances = balances_clone;
            if let Some(index) = balances.iter().position(|b| b.chain_id == chain_id) {
                // Update existing balance
                balances[index.try_into().unwrap()].balance = balance;
                self.atbtc_balances.insert(address, balances);
            } else {
                // Add new balance entry
                balances.push(atbtc_balance);
            }
        } else {
            let mut new_balances = Vector::new(StorageKey::Balance { key });
            new_balances.push(atbtc_balance);
            self.atbtc_balances.insert(address, new_balances);
        }
    }

    pub fn get_balance(&self, address: String) -> Vec<AtBTCBalance> {
        self.atbtc_balances
            .get(&address)
            .map(|v| v.iter().map(|b| b.clone()).collect::<Vec<AtBTCBalance>>())
            .unwrap_or_default()
    }
}
