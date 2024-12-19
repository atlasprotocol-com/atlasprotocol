use atlas_protocol::constants::network_type::SIGNET;
use atlas_protocol::modules::structs::Atlas;
use atlas_protocol::DepositRecord;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use near_sdk::PromiseOrValue;

fn setup_atlas() -> Atlas {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(0),
        accounts(0),
        "treasury_address".to_string(),
        false,
    );

    // Add two validators for the test chain
    atlas.add_validator(accounts(4), "SIGNET".to_string());
    atlas.add_validator(accounts(5), "SIGNET".to_string());
    atlas.add_validator(accounts(4), "NEAR_TESTNET".to_string());
    atlas.add_validator(accounts(5), "NEAR_TESTNET".to_string());
    atlas.add_validator(accounts(4), "421614".to_string());
    atlas.add_validator(accounts(5), "421614".to_string());
    atlas.add_validator(accounts(4), "11155420".to_string());
    atlas.add_validator(accounts(5), "11155420".to_string());

    atlas
}

#[test]
#[should_panic]
fn test_create_mint_abtc_signed_tx_paused() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    context.is_view(false);
    testing_env!(context.build());

    atlas.pause();
    atlas.create_mint_abtc_signed_tx(
        "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13".to_string(),
        94,
        5000000,
        100000000,
        0,
    );
}

#[test]
#[should_panic]
fn test_create_mint_abtc_signed_tx_not_admin() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(4));
    context.is_view(false);
    testing_env!(context.build());

    atlas.create_mint_abtc_signed_tx(
        "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13".to_string(),
        94,
        5000000,
        100000000,
        0,
    );
}

#[test]
#[should_panic(expected = "BTC transaction hash cannot be empty")]
fn test_create_mint_abtc_signed_tx_empty_btc_txn_hash() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    testing_env!(context.build());

    atlas.create_mint_abtc_signed_tx("".to_string(), 94, 5000000, 100000000, 0);
}

#[test]
#[should_panic(expected = "Gas cannot be zero")]
fn test_create_mint_abtc_signed_tx_zero_gas() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    testing_env!(context.build());

    atlas.create_mint_abtc_signed_tx(
        "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13".to_string(),
        94,
        0,
        100000000,
        0,
    );
}

#[test]
fn test_create_mint_abtc_signed_tx_not_found_deposit() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    testing_env!(context.build());

    let result: String = get_value(atlas.create_mint_abtc_signed_tx(
        "this-is-not-found".to_string(),
        94,
        5000000,
        100000000,
        0,
    ));
    assert_eq!(
        result,
        "Deposit not found or invalid conditions.".to_string()
    );
}

#[test]
fn test_create_mint_abtc_signed_tx_existing_deposit_status_not_waiting_mint() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    testing_env!(context.build());

    // Create deposit with status DEP_BTC_WAITING_MINTED_INTO_ABTC
    atlas.insert_deposit_btc(
        "123456".to_string(),
        "abc123".to_string(),
        1.to_string(),
        "421614".to_string(),
        50000,
        "".to_string(),
        1000,
        "".to_string(),
        1,
    );
    let result: String = get_value(atlas.create_mint_abtc_signed_tx(
        "123456".to_string(),
        94,
        5000000,
        100000000,
        0,
    ));
    assert_eq!(
        result,
        "Deposit not found or invalid conditions.".to_string()
    );
}

#[test]
fn test_create_mint_abtc_signed_tx_no_chain_config() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    testing_env!(context.build());

    // Insert a deposit with a non-existent receiving_chain_id
    atlas.insert_deposit_btc(
        "nonexistent_chain".to_string(),
        "abc123".to_string(),
        "421614".to_string(),
        "nonexistent_chain_id".to_string(), // This chain ID should not have a configuration
        50000,
        "".to_string(),
        1000,
        "".to_string(),
        1,
    );
    // Update status to DEP_BTC_WAITING_MINTED_INTO_ABTC
    atlas.update_deposit_btc_deposited("nonexistent_chain".to_string(), 1);

    // Change the context to accounts(1) before setting chain configs
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(0))
        .is_view(false)
        .build());
    // remove change config
    atlas.clear_all_chain_configs();
    // then change it back
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .is_view(false)
        .build());

    // Attempt to create mint transaction, which should panic due to missing chain config
    let result = get_value(atlas.create_mint_abtc_signed_tx(
        "nonexistent_chain".to_string(),
        94,
        5000000,
        100000000,
        0,
    ));

    assert_eq!(result, "Chain config not found.".to_string());
}

#[test]
fn test_create_mint_abtc_signed_tx_not_enough_verified_count() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    testing_env!(context.build());

    // Insert a deposit with a non-existent receiving_chain_id
    atlas.insert_deposit_btc(
        "123456".to_string(),
        "abc123".to_string(),
        "421614".to_string(),
        "0x2564186c643B292d6A4215f5C33Aa69b213414dd".to_string(), // This chain ID should not have a configuration
        50000,
        "".to_string(),
        1000,
        "".to_string(),
        1,
    );
    // Update status to DEP_BTC_WAITING_MINTED_INTO_ABTC
    atlas.update_deposit_btc_deposited("123456".to_string(), 1);

    // Attempt to create mint transaction, which should panic due to missing chain config
    let result = get_value(atlas.create_mint_abtc_signed_tx(
        "123456".to_string(),
        94,
        5000000,
        100000000,
        0,
    ));

    assert_eq!(result, "Validators threshold not met.".to_string());
}

#[test]
fn test_create_mint_abtc_signed_tx_return_evm_txn() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    testing_env!(context.build());

    // Insert a deposit with a non-existent receiving_chain_id
    atlas.insert_deposit_btc(
        "123456".to_string(),
        "abc123".to_string(),
        "421614".to_string(),
        "0x2564186c643B292d6A4215f5C33Aa69b213414dd".to_string(), // This chain ID should not have a configuration
        50000,
        "".to_string(),
        1000,
        "".to_string(),
        1,
    );
    // Update status to DEP_BTC_WAITING_MINTED_INTO_ABTC
    atlas.update_deposit_btc_deposited("123456".to_string(), 1000);

    // Create a DepositRecord for the deposit to be used in increment_deposit_verified_count
    let mempool_deposit = DepositRecord {
        btc_txn_hash: "123456".to_string(),
        btc_sender_address: "abc123".to_string(),
        receiving_chain_id: "421614".to_string(),
        receiving_address: "0x2564186c643B292d6A4215f5C33Aa69b213414dd".to_string(),
        btc_amount: 50000,
        timestamp: 1000,
        verified_count: 0,
        remarks: "".to_string(),
        status: 1,
        minted_txn_hash: "".to_string(),
        date_created: 1,
    };

    // Simulate the environment for the validator
    context.predecessor_account_id(accounts(4));
    testing_env!(context.build());

    // First validator increments the verified count
    assert!(atlas.increment_deposit_verified_count(mempool_deposit.clone()));

    // Change the environment for the second validator
    context.predecessor_account_id(accounts(5));
    testing_env!(context.build());

    // Second validator increments the verified count
    assert!(atlas.increment_deposit_verified_count(mempool_deposit));

    // then change it back
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .is_view(false)
        .build());

    atlas.create_mint_abtc_signed_tx("123456".to_string(), 94, 5000000, 100000000, 0);
}

fn get_value<T>(result: PromiseOrValue<T>) -> T {
    match result {
        PromiseOrValue::Value(value) => value,
        PromiseOrValue::Promise(_) => panic!("Cannot handle Promise in a synchronous test"),
    }
}
