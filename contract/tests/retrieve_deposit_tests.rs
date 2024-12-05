use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use atlas_protocol::modules::structs::Atlas;
use atlas_protocol::constants::status::*;

fn setup_atlas() -> Atlas {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    )
}

#[tokio::test]
async fn test_get_deposits_by_timestamp() {
    let mut atlas = setup_atlas();

    let btc_txn_hash1 = "btc_txn_hash1".to_string();
    let btc_txn_hash2 = "btc_txn_hash2".to_string();
    let btc_sender_address = "btc_sender_address".to_string();
    let receiving_chain_id = "receiving_chain_id".to_string();
    let receiving_address = "receiving_address".to_string();
    let btc_amount = 1000;
    let minted_txn_hash = "".to_string();
    let timestamp1 = 1234567890;
    let timestamp2 = 1234567895;
    let remarks = "".to_string();
    let date_created = 1234567890;

    atlas.insert_deposit_btc(
        btc_txn_hash1.clone(),
        btc_sender_address.clone(),
        receiving_chain_id.clone(),
        receiving_address.clone(),
        btc_amount,
        minted_txn_hash.clone(),
        timestamp1,
        remarks.clone(),
        date_created,
    );

    atlas.insert_deposit_btc(
        btc_txn_hash2.clone(),
        btc_sender_address.clone(),
        receiving_chain_id.clone(),
        receiving_address.clone(),
        btc_amount,
        minted_txn_hash.clone(),
        timestamp2,
        remarks.clone(),
        date_created,
    );

    let deposits = atlas.get_deposits_by_timestamp(1234567880, 1234567892);
    assert_eq!(deposits.len(), 1);
    assert_eq!(deposits[0].btc_txn_hash, btc_txn_hash1);

    let deposits = atlas.get_deposits_by_timestamp(1234567880, 1234567896);
    assert_eq!(deposits.len(), 2);
}

#[tokio::test]
async fn test_retrieve_non_existent_deposit() {
    let atlas = setup_atlas();

    let deposit = atlas.get_deposit_by_btc_txn_hash("non_existent_hash".to_string());
    assert!(deposit.is_none(), "Expected None for non-existent deposit");
}

#[tokio::test]
async fn test_deposit_count() {
    let mut atlas = setup_atlas();

    let btc_txn_hash1 = "btc_txn_hash1".to_string();
    let btc_txn_hash2 = "btc_txn_hash2".to_string();
    let btc_sender_address = "btc_sender_address".to_string();
    let receiving_chain_id = "receiving_chain_id".to_string();
    let receiving_address = "receiving_address".to_string();
    let btc_amount = 1000;
    let minted_txn_hash = "".to_string();
    let timestamp = 1234567890;
    let remarks = "".to_string();
    let date_created = 1234567890;

    atlas.insert_deposit_btc(
        btc_txn_hash1.clone(),
        btc_sender_address.clone(),
        receiving_chain_id.clone(),
        receiving_address.clone(),
        btc_amount,
        minted_txn_hash.clone(),
        timestamp,
        remarks.clone(),
        date_created,
    );

    atlas.insert_deposit_btc(
        btc_txn_hash2.clone(),
        btc_sender_address.clone(),
        receiving_chain_id.clone(),
        receiving_address.clone(),
        btc_amount,
        minted_txn_hash.clone(),
        timestamp,
        remarks.clone(),
        date_created,
    );

    assert_eq!(atlas.get_deposits_count(), 2);
}

#[tokio::test]
async fn test_get_all_deposits() {
    let mut atlas = setup_atlas();

    let btc_txn_hash1 = "btc_txn_hash1".to_string();
    let btc_txn_hash2 = "btc_txn_hash2".to_string();
    let btc_sender_address = "btc_sender_address".to_string();
    let receiving_chain_id = "receiving_chain_id".to_string();
    let receiving_address = "receiving_address".to_string();
    let btc_amount = 1000;
    let minted_txn_hash = "".to_string();
    let timestamp = 1234567890;
    let remarks = "".to_string();
    let date_created = 1234567890;

    atlas.insert_deposit_btc(
        btc_txn_hash1.clone(),
        btc_sender_address.clone(),
        receiving_chain_id.clone(),
        receiving_address.clone(),
        btc_amount,
        minted_txn_hash.clone(),
        timestamp,
        remarks.clone(),
        date_created,
    );

    atlas.insert_deposit_btc(
        btc_txn_hash2.clone(),
        btc_sender_address.clone(),
        receiving_chain_id.clone(),
        receiving_address.clone(),
        btc_amount,
        minted_txn_hash.clone(),
        timestamp,
        remarks.clone(),
        date_created,
    );

    let all_deposits = atlas.get_all_deposits();
    assert_eq!(all_deposits.len(), 2);
    assert!(all_deposits.iter().any(|d| d.btc_txn_hash == btc_txn_hash1));
    assert!(all_deposits.iter().any(|d| d.btc_txn_hash == btc_txn_hash2));
}

#[tokio::test]
async fn test_get_deposits_by_timestamp_empty_result() {
    let atlas = setup_atlas();

    let deposits = atlas.get_deposits_by_timestamp(1234567880, 1234567896);
    assert!(deposits.is_empty(), "Expected empty result for time range with no deposits");
}

#[tokio::test]
#[should_panic(expected = "Start time must be less than or equal to end time")]
async fn test_get_deposits_by_timestamp_invalid_range() {
    let atlas = setup_atlas();
    atlas.get_deposits_by_timestamp(1234567896, 1234567880);
}

#[tokio::test]
async fn test_get_deposits_by_timestamp_same_start_end() {
    let mut atlas = setup_atlas();

    let btc_txn_hash = "btc_txn_hash".to_string();
    let btc_sender_address = "btc_sender_address".to_string();
    let receiving_chain_id = "receiving_chain_id".to_string();
    let receiving_address = "receiving_address".to_string();
    let btc_amount = 1000;
    let minted_txn_hash = "".to_string();
    let timestamp = 1234567890;
    let remarks = "".to_string();
    let date_created = 1234567890;

    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        btc_sender_address,
        receiving_chain_id,
        receiving_address,
        btc_amount,
        minted_txn_hash,
        timestamp,
        remarks,
        date_created,
    );

    let deposits = atlas.get_deposits_by_timestamp(timestamp, timestamp);
    assert_eq!(deposits.len(), 1);
    assert_eq!(deposits[0].btc_txn_hash, btc_txn_hash);
}

#[tokio::test]
async fn test_get_deposit_by_btc_txn_hash_existing() {
    let mut atlas = setup_atlas();

    let btc_txn_hash = "btc_txn_hash".to_string();
    let btc_sender_address = "btc_sender_address".to_string();
    let receiving_chain_id = "receiving_chain_id".to_string();
    let receiving_address = "receiving_address".to_string();
    let btc_amount = 1000;
    let minted_txn_hash = "".to_string();
    let timestamp = 1234567890;
    let remarks = "".to_string();
    let date_created = 1234567890;

    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        btc_sender_address.clone(),
        receiving_chain_id.clone(),
        receiving_address.clone(),
        btc_amount,
        minted_txn_hash.clone(),
        timestamp,
        remarks.clone(),
        date_created,
    );

    let deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash.clone()).unwrap();
    assert_eq!(deposit.btc_txn_hash, btc_txn_hash);
    assert_eq!(deposit.btc_sender_address, btc_sender_address);
    assert_eq!(deposit.receiving_chain_id, receiving_chain_id);
    assert_eq!(deposit.receiving_address, receiving_address);
    assert_eq!(deposit.btc_amount, btc_amount);
    assert_eq!(deposit.minted_txn_hash, minted_txn_hash);
    assert_eq!(deposit.timestamp, timestamp);
    assert_eq!(deposit.status, DEP_BTC_PENDING_MEMPOOL);
    assert_eq!(deposit.remarks, remarks);
    assert_eq!(deposit.date_created, date_created);
    assert_eq!(deposit.verified_count, 0);
}

#[tokio::test]
#[should_panic(expected = "BTC transaction hash cannot be empty")]
async fn test_get_deposit_by_btc_txn_hash_empty_hash() {
    let atlas = setup_atlas();
    atlas.get_deposit_by_btc_txn_hash("".to_string());
}

#[tokio::test]
async fn test_get_deposits_count_empty() {
    let atlas = setup_atlas();
    assert_eq!(atlas.get_deposits_count(), 0);
}

#[tokio::test]
async fn test_get_all_deposits_empty() {
    let atlas = setup_atlas();
    let all_deposits = atlas.get_all_deposits();
    assert!(all_deposits.is_empty());
}