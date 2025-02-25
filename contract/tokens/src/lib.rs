use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::FungibleToken;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::{
    assert_one_yocto, env, log, near_bindgen, AccountId, Balance, PanicOnDefault, PromiseOrValue,
};
use serde_json::json;

const DATA_IMAGE_SVG_NEAR_ICON: &str = "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27100%27%20height=%27100%27%20viewBox=%270%200%20100%20100%27%3E%3Crect%20width=%27100%25%27%20height=%27100%25%27%20fill=%27black%27/%3E%3Ctext%20x=%2750%27%20y=%2750%27%20font-size=%2760%27%20font-family=%27Arial%27%20font-weight=%27bold%27%20fill=%27red%27%20text-anchor=%27middle%27%20dominant-baseline=%27middle%27%3EV%3C/text%3E%3C/svg%3E";

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
    owner_id: AccountId, // Store the owner's account ID
    pub paused: bool,
}

#[near_bindgen]
impl Contract {
    /// Initializes the contract with the given `owner_id` and metadata, with zero initial supply.
    #[init]
    pub fn new(owner_id: AccountId, metadata: FungibleTokenMetadata) -> Self {
        metadata.assert_valid();
        assert_eq!(metadata.decimals, 8, "Decimals must be set to 8 for atBTC");
        let mut this = Self {
            token: FungibleToken::new(b"a".to_vec()),
            metadata: LazyOption::new(b"m".to_vec(), Some(&metadata)),
            owner_id: owner_id.clone(), // Set the owner's account ID
            paused: false,
        };
        this.token.internal_register_account(&owner_id);
        this
    }

    // Assertions for ownership and admin
    pub fn assert_owner(&self) {
        assert_eq!(
            self.owner_id,
            env::predecessor_account_id(),
            "Only the owner can call this method"
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

    /// Mint new tokens to the specified `account_id`.
    /// Only the owner of the contract can call this method.
    pub fn mint_deposit(&mut self, account_id: AccountId, amount: U128, btc_txn_hash: String) {
        self.assert_not_paused();
        self.assert_owner();

        self.token.internal_deposit(&account_id, amount.into());

        let memo_string = format!(
            "{{\"address\":\"{}\",\"btc_txn_hash\":\"{}\"}}",
            account_id, btc_txn_hash
        );

        // Need to use this if not wallet won't display this token.
        near_contract_standards::fungible_token::events::FtMint {
            owner_id: &account_id,
            amount: &amount,
            memo: Some(&memo_string),
        }
        .emit();
    }

    pub fn mint_bridge(
        &mut self,
        account_id: AccountId,
        amount: U128,
        origin_chain_id: String,
        origin_chain_address: String,
        origin_txn_hash: String,
    ) {
        self.assert_not_paused();
        self.assert_owner();

        self.token.internal_deposit(&account_id, amount.into());

        let predecessor = env::predecessor_account_id();
        let event_log = json!({
            "standard": "nep141",
            "version": "1.0.0",
            "event": "ft_mint_bridge",
            "data": [{
                "owner_id": predecessor,
                "amount": amount.0.to_string(),
                "memo": format!("{{\"address\":\"{}\",\"originChainId\":\"{}\",\"originChainAddress\":\"{}\",\"originTxnHash\":\"{}\"}}", account_id, origin_chain_id, origin_chain_address, origin_txn_hash)
            }]
        }).to_string();

        env::log_str(&format!("EVENT_JSON:{}", event_log));
    }

    /// Custom burn function that logs the btcAddress for the redemption process
    #[payable]
    pub fn burn_redeem(&mut self, amount: U128, btc_address: String) {
        self.assert_not_paused();

        assert_one_yocto();
        let predecessor = env::predecessor_account_id();
        self.token.internal_withdraw(&predecessor, amount.into());
        let event_log = json!({
            "standard": "nep141",
            "version": "1.0.0",
            "event": "ft_burn_redeem",
            "data": [{
                "owner_id": predecessor,
                "amount": amount.0.to_string(),
                "memo": format!("{{\"address\":\"{}\",\"btcAddress\":\"{}\",\"amount\":\"{}\"}}", predecessor, btc_address, amount.0)
            }]
        }).to_string();

        env::log_str(&format!("EVENT_JSON:{}", event_log));
    }

    /// Custom burn function that logs the destination chainId and address for the bridging process
    #[payable]
    pub fn burn_bridge(&mut self, amount: U128, dest_chain_id: String, dest_chain_address: String, minting_fee_sat: U128, bridging_fee_sat: U128) {
        self.assert_not_paused();

        assert_one_yocto();
        let predecessor = env::predecessor_account_id();
        self.token.internal_withdraw(&predecessor, amount.into());
        let event_log = json!({
            "standard": "nep141",
            "version": "1.0.0",
            "event": "ft_burn_bridge",
            "data": [{
                "owner_id": predecessor,
                "amount": amount.0.to_string(),
                "memo": format!("{{\"address\":\"{}\",\"destChainId\":\"{}\",\"destChainAddress\":\"{}\",\"amount\":\"{}\",\"mintingFeeSat\":\"{}\",\"bridgingFeeSat\":\"{}\"}}", predecessor, dest_chain_id, dest_chain_address, amount.0.to_string(), minting_fee_sat.0.to_string(), bridging_fee_sat.0.to_string())
            }]
        }).to_string();

        env::log_str(&format!("EVENT_JSON:{}", event_log));
    }

    fn on_account_closed(&mut self, account_id: AccountId, balance: Balance) {
        log!("Closed @{} with {}", account_id, balance);
    }

    fn on_tokens_burned(&mut self, account_id: AccountId, amount: Balance) {
        log!("Account @{} burned {}", account_id, amount);
    }
}

near_contract_standards::impl_fungible_token_core!(Contract, token, on_tokens_burned);
near_contract_standards::impl_fungible_token_storage!(Contract, token, on_account_closed);

#[near_bindgen]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().unwrap()
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::MockedBlockchain;
    use near_sdk::{testing_env, Balance};

    use super::*;

    const TOTAL_SUPPLY: Balance = 1_000_000_000_000_000;

    fn get_context(predecessor_account_id: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id);
        builder
    }

    #[test]
    fn test_new() {
        let mut context = get_context(accounts(1));
        testing_env!(context.build());
        let contract = Contract::new(
            accounts(1).into(),
            FungibleTokenMetadata {
                spec: FT_METADATA_SPEC.to_string(),
                name: "Example NEAR fungible token".to_string(),
                symbol: "EXAMPLE".to_string(),
                icon: Some(DATA_IMAGE_SVG_NEAR_ICON.to_string()),
                reference: None,
                reference_hash: None,
                decimals: 8,
            },
        );
        testing_env!(context.is_view(true).build());
        assert_eq!(contract.ft_total_supply().0, 0); // Initially, total supply should be 0
        assert_eq!(contract.ft_balance_of(accounts(1)).0, 0); // Initially, balance should be 0
    }

    #[test]
    fn test_mint() {
        let mut context = get_context(accounts(1));
        testing_env!(context.build());
        let mut contract = Contract::new(
            accounts(1).into(),
            FungibleTokenMetadata {
                spec: FT_METADATA_SPEC.to_string(),
                name: "Example NEAR fungible token".to_string(),
                symbol: "EXAMPLE".to_string(),
                icon: Some(DATA_IMAGE_SVG_NEAR_ICON.to_string()),
                reference: None,
                reference_hash: None,
                decimals: 8,
            },
        );

        // Mint some tokens with a dummy BTC transaction hash
        let btc_txn_hash = "dummy_btc_txn_hash".to_string();
        contract.mint_deposit(accounts(1).into(), U128(1000), btc_txn_hash);
        testing_env!(context.is_view(true).build());
        assert_eq!(contract.ft_total_supply().0, 1000);
        assert_eq!(contract.ft_balance_of(accounts(1)).0, 1000);
    }

    #[test]
    #[should_panic(expected = "The contract is not initialized")]
    fn test_default() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        let _contract = Contract::default();
    }

    #[test]
    fn test_transfer() {
        let mut context = get_context(accounts(2));
        testing_env!(context.build());
        let mut contract = Contract::new(
            accounts(2).into(),
            FungibleTokenMetadata {
                spec: FT_METADATA_SPEC.to_string(),
                name: "Example NEAR fungible token".to_string(),
                symbol: "EXAMPLE".to_string(),
                icon: Some(DATA_IMAGE_SVG_NEAR_ICON.to_string()),
                reference: None,
                reference_hash: None,
                decimals: 8,
            },
        );
        let btc_txn_hash = "dummy_btc_txn_hash".to_string();
        contract.mint_deposit(accounts(2).into(), U128(1000), btc_txn_hash);
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(contract.storage_balance_bounds().min.into())
            .predecessor_account_id(accounts(1))
            .build());
        // Paying for account registration, aka storage deposit
        contract.storage_deposit(None, None);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(accounts(2))
            .build());
        let transfer_amount = 1000 / 3;
        contract.ft_transfer(accounts(1), transfer_amount.into(), None);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .is_view(true)
            .attached_deposit(0)
            .build());
        assert_eq!(
            contract.ft_balance_of(accounts(2)).0,
            1000 - transfer_amount
        );
        assert_eq!(contract.ft_balance_of(accounts(1)).0, transfer_amount);
    }
}
