use crate::atlas::Atlas;
use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use crate::AtlasExt;
use near_sdk::{env, near_bindgen, store::IterableMap, AccountId};

#[near_bindgen]
impl Atlas {
    #[init]
    pub fn new(atlas_owner_id: AccountId, atlas_admin_id: AccountId, global_params_owner_id: AccountId, chain_configs_owner_id: AccountId, treasury_address: String) -> Self {
        env::log_str("Initializing Atlas");

        // Validate input parameters
        assert!(!atlas_owner_id.to_string().is_empty(), "Atlas owner ID cannot be empty");
        assert!(!atlas_admin_id.to_string().is_empty(), "Atlas admin ID cannot be empty");
        assert!(!global_params_owner_id.to_string().is_empty(), "Global params owner ID cannot be empty");
        assert!(!chain_configs_owner_id.to_string().is_empty(), "Chain configs owner ID cannot be empty");
        assert!(!treasury_address.is_empty(), "Treasury address cannot be empty");

        Self {
            deposits: IterableMap::new(b"d"),
            redemptions: IterableMap::new(b"r"),
            owner_id: atlas_owner_id,
            admin_id: atlas_admin_id,
            global_params: GlobalParams::init_global_params(global_params_owner_id, treasury_address),
            chain_configs: ChainConfigs::init_chain_configs(chain_configs_owner_id),
            validators: IterableMap::new(b"v"),
            verifications: IterableMap::new(b"f"),
            last_evm_tx: None, // Initialize with None
        }
    }

    pub fn get_atlas_owner_id(&self) -> AccountId {
        self.owner_id.clone()
    }

    pub fn change_atlas_owner_id(&mut self, new_owner_id: AccountId) {
        self.assert_owner();

        assert!(
            !new_owner_id.to_string().is_empty(),
            "New owner ID cannot be blank"
        );
        assert_ne!(
            new_owner_id, self.owner_id,
            "New owner ID must be different from the current owner ID"
        );

        // Log the change for transparency
        env::log_str(&format!(
            "Changing Atlas owner from {} to {}",
            self.owner_id, new_owner_id
        ));

        self.owner_id = new_owner_id;
    }

    pub fn get_atlas_admin_id(&self) -> AccountId {
        self.admin_id.clone()
    }

    pub fn change_atlas_admin_id(&mut self, new_admin_id: AccountId) {
        self.assert_owner();

        assert!(!new_admin_id.to_string().is_empty(), "New admin ID cannot be blank");
        assert_ne!(new_admin_id, self.admin_id, "New admin ID must be different from the current admin ID");

        // Log the change for transparency
        env::log_str(&format!(
            "Changing Atlas admin from {} to {}",
            self.admin_id, new_admin_id
        ));

        self.admin_id = new_admin_id;
    }

    pub fn assert_owner(&self) {
        assert_eq!(self.owner_id, env::predecessor_account_id(), "Only the owner can call this method");
    }

    pub fn assert_admin(&self) {
        assert_eq!(self.admin_id, env::predecessor_account_id(), "Only the admin can call this method");
    }
}
