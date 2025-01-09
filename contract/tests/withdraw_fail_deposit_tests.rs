use atlas_protocol::constants::status::DEP_BTC_DEPOSITED_INTO_ATLAS;
use atlas_protocol::modules::structs::Atlas;
use atlas_protocol::{UtxoInput, WithDrawFailDepositResult};
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
fn test_withdraw_fail_deposit_by_btc_tx_hash_paused() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    atlas.pause();
    atlas.withdraw_fail_deposit_by_btc_tx_hash(
        "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13".to_string(),
        vec![],
        0,
    );
}

#[test]
#[should_panic]
fn test_withdraw_fail_deposit_by_btc_tx_hash_not_admin() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(4));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    atlas.withdraw_fail_deposit_by_btc_tx_hash(
        "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13".to_string(),
        vec![],
        0,
    );
}

#[test]
#[should_panic(expected = "BTC transaction hash cannot be empty")]
fn test_withdraw_fail_deposit_by_btc_tx_hash_empty_btc_txn_hash() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    atlas.withdraw_fail_deposit_by_btc_tx_hash("".to_string(), vec![], 0);
}

#[test]
#[should_panic(expected = "Deposit is not found.")]
fn test_withdraw_fail_deposit_by_btc_tx_hash_not_found_deposit() {
    let mut atlas = setup_atlas();

    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    context.is_view(false);
    context.block_timestamp(1234567890);
    testing_env!(context.build());

    atlas.withdraw_fail_deposit_by_btc_tx_hash("this-is-not-found".to_string(), vec![], 0);
}

#[test]
#[should_panic(expected = "Deposit is not in invalid conditions.")]
fn test_withdraw_fail_deposit_by_btc_tx_hash_not_valid_conditions() {
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
        "".to_string(),
        1000,
        "".to_string(),
        1,
    );

    atlas.withdraw_fail_deposit_by_btc_tx_hash("123456".to_string(), vec![], 0);
}

#[test]
fn test_withdraw_fail_deposit_by_btc_tx_hash() {
    let btc_amount = 50000;
    let (mut atlas, result) = setup_withdraw_fail_deposit(btc_amount);

    assert!(!result.psbt.is_empty());

    assert!(result.utxos.iter().any(|utxo| utxo.txid == "tx_hash_5"));
    assert!(result.utxos.iter().any(|utxo| utxo.txid == "tx_hash_4"));
    assert!(result.utxos.iter().any(|utxo| utxo.txid == "tx_hash_3"));
    assert!(result.utxos.iter().any(|utxo| utxo.txid == "tx_hash_2"));
    assert!(!result.utxos.iter().any(|utxo| utxo.txid == "tx_hash_1"));

    assert_eq!(result.estimated_fee, 0);
    assert_eq!(result.receive_amount, btc_amount);
    assert_eq!(result.change, 11000);
}

#[test]
#[should_panic(expected = "Transaction hash cannot be empty")]
fn test_update_deposit_custody_txn_id_empty_btc_txn_hash() {
    let mut atlas = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.update_deposit_custody_txn_id("".to_string(), "custody_txn_id".to_string());
}

#[test]
#[should_panic(expected = "Custody transaction ID cannot be empty")]
fn test_update_deposit_custody_txn_id_empty_custody_txn_id() {
    let mut atlas = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.update_deposit_custody_txn_id("btc_txn_hash".to_string(), "".to_string());
}

#[test]
#[should_panic(expected = "Deposit record not found")]
fn test_update_deposit_custody_txn_id_deposit_not_found() {
    let mut atlas = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.update_deposit_custody_txn_id("btc_txn_hash".to_string(), "custody_txn_id".to_string());
}

#[test]
#[should_panic(expected = "Deposit is not in invalid conditions")]
fn test_update_deposit_custody_txn_id_not_valid_conditions() {
    let btc_amount = 50000;
    let (mut atlas, result) = setup_withdraw_fail_deposit(btc_amount);

    atlas.update_deposit_remarks(
        result.btc_txn_hash.clone(),
        "oops, something went wrong".to_string(),
    );

    atlas.update_deposit_custody_txn_id(result.btc_txn_hash.clone(), "custody_txn_id".to_string());
    atlas.update_deposit_custody_txn_id(
        result.btc_txn_hash.clone(),
        "another_custody_txn_id".to_string(),
    );
}

#[test]
fn test_update_deposit_custody_txn_id() {
    let btc_amount = 50000;
    let (mut atlas, result) = setup_withdraw_fail_deposit(btc_amount);

    atlas.update_deposit_custody_txn_id(result.btc_txn_hash.clone(), "custody_txn_id".to_string());
}

fn setup_withdraw_fail_deposit(btc_amount: u64) -> (Atlas, WithDrawFailDepositResult) {
    let mut atlas = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(0))
        .build());
    atlas.update_max_retry_count(1);

    // 1. Insert a deposit
    let btc_txn_hash =
        "cd5760b19bf4684388f738917514d170145c839916b7dcc675c6da36bb81c979".to_string();
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "tb1qvg6mywtj0zdreskfflv838kxdy3q438t86dj5v".to_string(),
        "NEAR_TESTNET".to_string(),
        "velar.testnet".to_string(),
        btc_amount,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );

    // 2. Update deposit status to BTC_DEPOSITED
    atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), 1234567890);

    // 3. Verify deposit by validators
    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.status, DEP_BTC_DEPOSITED_INTO_ATLAS);

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(4))
        .build());
    atlas.increment_deposit_verified_count(deposit.clone());
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(5))
        .build());
    atlas.increment_deposit_verified_count(deposit);

    // 3. Verify deposit by validators
    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.verified_count, 2);

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .block_timestamp(1234567890)
        .build());

    // first retry
    atlas.create_mint_abtc_signed_tx(deposit.btc_txn_hash.clone(), 94, 5000000, 100000000, 0);
    atlas.update_deposit_remarks(
        btc_txn_hash.clone(),
        "oops, something went wrong at first try".to_string(),
    );
    atlas.rollback_deposit_status_by_btc_txn_hash(btc_txn_hash.clone());

    // second retry
    atlas.create_mint_abtc_signed_tx(deposit.btc_txn_hash.clone(), 94, 5000000, 100000000, 0);
    atlas.update_deposit_remarks(
        btc_txn_hash.clone(),
        "oops, something went wrong at second try".to_string(),
    );

    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.retry_count, 1);

    let utxos = vec![
        UtxoInput {
            txid: "tx_hash_1".to_string(),
            vout: 0,
            value: 30000,
            script: "".to_string(),
        },
        UtxoInput {
            txid: "tx_hash_2".to_string(),
            vout: 1,
            value: 25000,
            script: "".to_string(),
        },
        UtxoInput {
            txid: "tx_hash_3".to_string(),
            vout: 2,
            value: 20000,
            script: "".to_string(),
        },
        UtxoInput {
            txid: "tx_hash_4".to_string(),
            vout: 3,
            value: 15000,
            script: "".to_string(),
        },
        UtxoInput {
            txid: "tx_hash_5".to_string(),
            vout: 4,
            value: 1000,
            script: "".to_string(),
        },
    ];

    let result: WithDrawFailDepositResult =
        atlas.withdraw_fail_deposit_by_btc_tx_hash(btc_txn_hash.clone(), utxos, 0);

    (atlas, result)
}
