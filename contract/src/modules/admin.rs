use crate::atlas::Atlas;
use crate::chain_configs::ChainConfigs;
use crate::constants::near_gas::*;
use crate::global_params::GlobalParams;
use crate::modules::signer::*;
use crate::AtlasExt;
use hex::FromHex;
use near_sdk::env::keccak256;
use near_sdk::{
    env, log, near_bindgen, store::IterableMap, AccountId, NearToken, PromiseError, PromiseOrValue,
};
use omni_transaction::evm::evm_transaction::EVMTransaction;
use omni_transaction::evm::types::Signature as OmniSignature;
use omni_transaction::evm::utils::parse_eth_address;
use omni_transaction::transaction_builder::{
    TransactionBuilder as OmniTransactionBuilder, TxBuilder,
};
use omni_transaction::types::EVM;

#[near_bindgen]
impl Atlas {
    #[init]
    pub fn new(
        atlas_owner_id: AccountId,
        atlas_admin_id: AccountId,
        global_params_owner_id: AccountId,
        chain_configs_owner_id: AccountId,
        treasury_address: String,
        production_mode: bool,
    ) -> Self {
        env::log_str("Initializing Atlas");

        // Validate input parameters
        assert_ne!(
            atlas_owner_id, atlas_admin_id,
            "Atlas owner and Atlas admin cannot be the same user"
        );
        assert!(
            !atlas_owner_id.to_string().is_empty(),
            "Atlas owner ID cannot be empty"
        );
        assert!(
            !atlas_admin_id.to_string().is_empty(),
            "Atlas admin ID cannot be empty"
        );
        assert!(
            !chain_configs_owner_id.to_string().is_empty(),
            "Chain configs owner ID cannot be empty"
        );

        Self {
            deposits: IterableMap::new(b"d"),
            redemptions: IterableMap::new(b"r"),
            owner_id: atlas_owner_id,
            proposed_owner_id: None,
            admin_id: atlas_admin_id,
            proposed_admin_id: None,
            global_params: GlobalParams::init_global_params(
                global_params_owner_id,
                treasury_address,
            ),
            chain_configs: ChainConfigs::init_chain_configs(chain_configs_owner_id),
            validators: IterableMap::new(b"v"),
            verifications: IterableMap::new(b"f"),
            last_evm_tx: None, // Initialize with None
            paused: false,
            production_mode: production_mode,
        }
    }

    // Atlas owner functions
    pub fn get_atlas_owner_id(&self) -> AccountId {
        self.owner_id.clone()
    }

    pub fn propose_new_atlas_owner(&mut self, proposed_owner_id: AccountId) {
        self.assert_owner();

        assert_ne!(
            proposed_owner_id, self.owner_id,
            "Proposed owner ID must be different from the current owner ID"
        );
        assert_ne!(
            proposed_owner_id, self.admin_id,
            "Proposed owner ID cannot be the same as the current admin ID"
        );
        assert!(
            !proposed_owner_id.to_string().is_empty(),
            "Proposed owner ID cannot be blank"
        );

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

        assert_ne!(
            proposed_admin_id, self.admin_id,
            "Proposed admin ID must be different from the current admin ID"
        );
        assert_ne!(
            proposed_admin_id, self.owner_id,
            "Proposed admin ID cannot be the same as the current owner ID"
        );
        assert_ne!(
            Some(proposed_admin_id.clone()),
            self.proposed_owner_id,
            "Proposed admin ID cannot be the same as the proposed owner ID"
        );
        assert!(
            !proposed_admin_id.to_string().is_empty(),
            "Proposed admin ID cannot be blank"
        );

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

    // Function to check if the contract is in production mode or testnet mode
    pub fn is_production_mode(&self) -> bool {
        self.production_mode
    }

    pub fn create_abtc_accept_ownership_tx(
        &mut self,
        chain_id: String,
        nonce: u64,
        gas: u128,
        max_fee_per_gas: u128,
        max_priority_fee_per_gas: u128,
    ) -> PromiseOrValue<String> {
        self.assert_not_paused();
        self.assert_owner();

        // Validate input parameters
        assert!(!chain_id.is_empty(), "Chain ID cannot be empty");
        assert!(gas != 0, "Gas cannot be zero");

        if !self
            .chain_configs
            .get_chain_config(chain_id.clone())
            .is_some()
        {
            env::panic_str("Chain ID not found");
        }

        let chain_config = self
            .chain_configs
            .get_chain_config(chain_id.clone())
            .expect("Chain ID not found");

        let to_address_str = chain_config.abtc_address.strip_prefix("0x").unwrap();
        let to_address = parse_eth_address(to_address_str);
        let value_as_128 = 0;

        let data: Vec<u8> = Self::encode_abtc_accept_ownership_function_call();

        let evm_tx = OmniTransactionBuilder::new::<EVM>()
            .nonce(nonce)
            .to(to_address)
            .value(value_as_128)
            .input(data.clone())
            .max_priority_fee_per_gas(max_priority_fee_per_gas)
            .max_fee_per_gas(max_fee_per_gas)
            .gas_limit(gas)
            .chain_id(chain_id.clone().parse::<u64>().unwrap_or_else(|_| {
                // Handle the error case, e.g., log an error and provide a default value
                env::panic_str("Invalid chain ID format.");
            }))
            .build();

        let evm_tx_encoded = evm_tx.build_for_signing();

        let evm_tx_hash = keccak256(&evm_tx_encoded);
        log!("Payload: [{}] {:?}", evm_tx_hash.len(), evm_tx_hash);

        let path = chain_config.network_type.clone();
        // Call MPC
        return PromiseOrValue::Promise(
            ext_signer::ext(self.global_params.get_mpc_contract())
                .with_attached_deposit(NearToken::from_millinear(500))
                .sign(SignRequest::new(
                    evm_tx_hash
                        .try_into()
                        .unwrap_or_else(|e| panic!("Failed to convert payload {:?}", e)),
                    path,
                    0,
                ))
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(SIGN_CALLBACK_GAS)
                        .with_unused_gas_weight(0)
                        .sign_transfer_ownership_callback(evm_tx),
                ),
        );
    }

    // Helper function to encode the accept_ownership function call
    fn encode_abtc_accept_ownership_function_call() -> Vec<u8> {
        let accept_ownership_function_signature = "acceptOwnership()"; // Updated Solidity function signature

        // Compute the Keccak-256 hash of the function signature and take the first 4 bytes
        let function_selector = &keccak256(accept_ownership_function_signature.as_bytes())[0..4];

        let mut function_call_data = Vec::with_capacity(function_selector.len());
        function_call_data.extend_from_slice(function_selector); // Add the function selector

        function_call_data
    }

    #[private]
    pub fn sign_transfer_ownership_callback(
        &self,
        evm_tx: EVMTransaction,
        #[callback_result] result: Result<SignResult, PromiseError>,
    ) -> Vec<u8> {
        if let Ok(sign_result) = result {
            let big_r = &sign_result.big_r.affine_point;
            let s = &sign_result.s.scalar;
            let recovery_id = &sign_result.recovery_id;

            let v: u64 = *recovery_id as u64;

            let r = &big_r[2..];
            let end = &big_r[..2];

            let r_bytes = Vec::from_hex(r).expect("Invalid hex in r");
            let s_bytes = Vec::from_hex(s).expect("Invalid hex in s");
            let _end_bytes = Vec::from_hex(end).expect("Invalid hex in end");

            let signature_omni: OmniSignature = OmniSignature {
                v: v,
                r: r_bytes.to_vec(),
                s: s_bytes.to_vec(),
            };

            // Now you can use `evm_tx` and build the transaction with signature
            let near_tx_signed = evm_tx.build_with_signature(&signature_omni);

            // Return the signed transaction here
            return near_tx_signed;
        } else {
            panic!("Callback failed");
        }
    }
}
