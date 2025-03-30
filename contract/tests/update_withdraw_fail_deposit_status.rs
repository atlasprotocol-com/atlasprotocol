use atlas_protocol::constants::status::{DEP_BTC_REFUNDED, DEP_BTC_REFUNDING};
use atlas_protocol::modules::structs::Atlas;
use atlas_protocol::{DepositRecord, UtxoInput, WithDrawFailDepositResult};
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;

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
fn test_update_withdraw_fail_deposit_status_paused() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    atlas.pause();
    atlas.update_withdraw_fail_deposit_status(
        "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13".to_string(),
        0,
    );
}

#[test]
#[should_panic]
fn test_update_withdraw_fail_deposit_status_not_admin() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(4));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    atlas.update_withdraw_fail_deposit_status(
        "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13".to_string(),
        0,
    );
}

#[test]
#[should_panic(expected = "BTC transaction hash cannot be empty")]
fn test_update_withdraw_fail_deposit_status_empty_btc_txn_hash() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    atlas.update_withdraw_fail_deposit_status("".to_string(), 0);
}

#[test]
#[should_panic(expected = "Timestamp must be greater than zero")]
fn test_update_withdraw_fail_deposit_status_timestamp_zero() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    atlas.update_withdraw_fail_deposit_status(
        "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13".to_string(),
        0,
    );
}

#[test]
#[should_panic(expected = "Deposit is not found.")]
fn test_update_withdraw_fail_deposit_status_not_found_deposit() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    atlas.update_withdraw_fail_deposit_status("this-is-not-found".to_string(), 1);
}

#[test]
#[should_panic(expected = "Deposit is not in invalid conditions.")]
fn test_update_withdraw_fail_deposit_status_not_valid_conditions() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    // Create deposit with status DEP_BTC_WAITING_MINTED_INTO_ABTC
    atlas.insert_deposit_btc(
        "123456".to_string(),
        "abc123".to_string(),
        1.to_string(),
        "421614".to_string(),
        50000,
        0,
        "".to_string(),
        1000,
        "".to_string(),
        1,
    );

    atlas.update_withdraw_fail_deposit_status("123456".to_string(), 1);
}

#[test]
fn test_update_withdraw_fail_deposit_status() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    let record = DepositRecord {
        btc_txn_hash: "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13"
            .to_string(),
        btc_sender_address: "abc123".to_string(),
        receiving_chain_id: "1".to_string(),
        receiving_address: "421614".to_string(),
        btc_amount: 1000,
        protocol_fee: 0,
        minted_txn_hash: "".to_string(),
        timestamp: 1,
        status: DEP_BTC_REFUNDING,
        remarks: "".to_string(),
        date_created: 1,
        verified_count: 0,
        retry_count: 0,
        minted_txn_hash_verified_count: 0,
        custody_txn_id: "2".to_string(),
    };
    atlas.deposits.insert(record.btc_txn_hash.clone(), record);

    atlas.update_withdraw_fail_deposit_status(
        "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13".to_string(),
        1,
    );

    let deposit = atlas
        .get_deposit_by_btc_txn_hash(
            "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13".to_string(),
        )
        .unwrap();
    assert_eq!(deposit.status, DEP_BTC_REFUNDED);
}
