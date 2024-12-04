use crate::atlas::Atlas;
use crate::chain_configs::ChainConfigs;
use crate::global_params::GlobalParams;
use crate::AtlasExt;
use near_sdk::{env, near_bindgen, store::IterableMap, AccountId};

#[near_bindgen]
impl Atlas {
    #[init]
    pub fn new(
        atlas_owner_id: AccountId,
        atlas_admin_id: AccountId,
        global_params_owner_id: AccountId,
        chain_configs_owner_id: AccountId,
        treasury_address: String,
    ) -> Self {
        env::log_str("Initializing Atlas");

        // Validate input parameters
        assert_ne!(
            atlas_owner_id, atlas_admin_id,
            "Atlas owner and Atlas admin cannot be the same user"
        );
        assert!(!atlas_owner_id.to_string().is_empty(), "Atlas owner ID cannot be empty");
        assert!(!atlas_admin_id.to_string().is_empty(), "Atlas admin ID cannot be empty");        
        assert!(!chain_configs_owner_id.to_string().is_empty(), "Chain configs owner ID cannot be empty");        

        Self {
            deposits: IterableMap::new(b"d"),
            redemptions: IterableMap::new(b"r"),
            owner_id: atlas_owner_id,
            proposed_owner_id: None,
            admin_id: atlas_admin_id,
            proposed_admin_id: None,
            global_params: GlobalParams::init_global_params(global_params_owner_id, treasury_address),
            chain_configs: ChainConfigs::init_chain_configs(chain_configs_owner_id),
            validators: IterableMap::new(b"v"),
            verifications: IterableMap::new(b"f"),
            last_evm_tx: None, // Initialize with None
            paused: false,
        }
    }

    // Atlas owner functions
    pub fn get_atlas_owner_id(&self) -> AccountId {
        self.owner_id.clone()
    }

    pub fn propose_new_atlas_owner(&mut self, proposed_owner_id: AccountId) {
        self.assert_owner();

        assert_ne!(proposed_owner_id, self.owner_id, "Proposed owner ID must be different from the current owner ID");
        assert_ne!(proposed_owner_id, self.admin_id, "Proposed owner ID cannot be the same as the current admin ID");
        assert!(!proposed_owner_id.to_string().is_empty(), "Proposed owner ID cannot be blank");

        env::log_str(&format!(
            "Proposing new Atlas owner from {} to {}",
            self.owner_id, proposed_owner_id
        ));

        self.proposed_owner_id = Some(proposed_owner_id);
    }

    pub fn accept_atlas_owner(&mut self) {
        let caller = env::predecessor_account_id();

        assert_eq!(
            Some(caller.clone()),
            self.proposed_owner_id,
            "Only the proposed owner can accept the ownership"
        );

        env::log_str(&format!(
            "Accepting Atlas ownership from {} to {}",
            self.owner_id, caller
        ));

        self.owner_id = caller;
        self.proposed_owner_id = None;
    }

    // Atlas admin functions
    pub fn get_atlas_admin_id(&self) -> AccountId {
        self.admin_id.clone()
    }

    pub fn propose_new_atlas_admin(&mut self, proposed_admin_id: AccountId) {
        self.assert_owner();

        assert_ne!(proposed_admin_id, self.admin_id, "Proposed admin ID must be different from the current admin ID");
        assert_ne!(proposed_admin_id, self.owner_id, "Proposed admin ID cannot be the same as the current owner ID");
        assert!(!proposed_admin_id.to_string().is_empty(), "Proposed admin ID cannot be blank");

        env::log_str(&format!(
            "Proposing new Atlas admin from {} to {}",
            self.admin_id, proposed_admin_id
        ));

        self.proposed_admin_id = Some(proposed_admin_id);
    }

    pub fn accept_atlas_admin(&mut self) {
        let caller = env::predecessor_account_id();

        assert_eq!(
            Some(caller.clone()),
            self.proposed_admin_id,
            "Only the proposed admin can accept the admin role"
        );

        env::log_str(&format!(
            "Accepting Atlas admin role from {} to {}",
            self.admin_id, caller
        ));

        self.admin_id = caller;
        self.proposed_admin_id = None;
    }

    // Assertions for ownership and admin
    pub fn assert_owner(&self) {
        assert_eq!(
            self.owner_id,
            env::predecessor_account_id(),
            "Only the owner can call this method"
        );
    }

    pub fn assert_admin(&self) {
        assert_eq!(
            self.admin_id,
            env::predecessor_account_id(),
            "Only the admin can call this method"
        );
    }

    // Function to pause the contract
    pub fn pause(&mut self) {
        self.assert_owner(); // Only the owner can pause the contract
        self.paused = true;
        env::log_str("Contract is paused");
    }

    // Function to unpause the contract
    pub fn unpause(&mut self) {
        self.assert_owner(); // Only the owner can unpause the contract
        self.paused = false;
        env::log_str("Contract is unpaused");
    }

    // Function to check if the contract is paused
    pub fn assert_not_paused(&self) {
        assert!(!self.paused, "Contract is paused");
    }

    // Function to check if the contract is paused
    pub fn is_paused(&self) -> bool {
        self.paused
    }
}
