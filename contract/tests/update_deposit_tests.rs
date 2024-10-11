use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use atlas_protocol::modules::structs::Atlas;
use atlas_protocol::constants::status::*;
use atlas_protocol::chain_configs::ChainConfigRecord;
use atlas_protocol::constants::network_type::SIGNET;
use serde_json::json;

fn setup_atlas() -> Atlas {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    // Create JSON string for chain config
    let chain_config_json = json!({
        "chains": [{
            "chain_id": SIGNET,
            "network_type": "SIGNET",
            "network_name": "Bitcoin Signet",
            "chain_rpc_url": "https://mempool.space/signet/api",
            "explorer_url": "https://mempool.space/signet/",
            "abtc_address": "",
            "native_currency_name": "BTC",
            "native_currency_decimals": 8,
            "native_currency_symbol": "BTC",
            "first_block": 0,
            "batch_size": 0,
            "gas_limit": 0,
            "abi_path": "",
            "validators_threshold": 2
        }]
    }).to_string();

    // Set chain configs using the JSON string
    // Change the context to accounts(3) before setting chain configs
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(3)).build());
    atlas.set_chain_configs_from_json(chain_config_json);

    // Add two validators for SIGNET
    // Change the context back to accounts(0) for adding validators
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(0)).build());
    atlas.add_validator(accounts(1), SIGNET.to_string());
    atlas.add_validator(accounts(2), SIGNET.to_string());
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas
}

#[tokio::test]
async fn test_update_deposit_btc_deposited() {
    let mut atlas = setup_atlas();

    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        SIGNET.to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );

    let new_timestamp = 1234567891;
    atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), new_timestamp);

    let deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash.clone()).unwrap();
    assert_eq!(deposit.status, DEP_BTC_DEPOSITED_INTO_ATLAS);
    assert_eq!(deposit.timestamp, new_timestamp);
}

#[tokio::test]
async fn test_update_deposit_minted() {
    let mut atlas = setup_atlas();

    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        SIGNET.to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );

    atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), 1234567891);

    // Simulate verification by two validators
    let deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash.clone()).unwrap();
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.increment_deposit_verified_count(deposit.clone());
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    atlas.increment_deposit_verified_count(deposit);

    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    let minted_txn_hash = "minted_txn_hash".to_string();
    atlas.update_deposit_minted(btc_txn_hash.clone(), minted_txn_hash.clone());

    let updated_deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash.clone()).unwrap();
    assert_eq!(updated_deposit.status, DEP_BTC_MINTED_INTO_ABTC);
    assert_eq!(updated_deposit.minted_txn_hash, minted_txn_hash);
}

#[tokio::test]
async fn test_update_deposit_multiple_times() {
    let mut atlas = setup_atlas();

    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        SIGNET.to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );

    atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), 1234567891);

    // Simulate verification by two validators
    let deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash.clone()).unwrap();
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.increment_deposit_verified_count(deposit.clone());
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    atlas.increment_deposit_verified_count(deposit);

    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.update_deposit_minted(btc_txn_hash.clone(), "minted_txn_hash".to_string());
    
    // Try to update remarks after minting (this should not change the remarks)
    atlas.update_deposit_remarks(btc_txn_hash.clone(), "Updated remarks".to_string());

    let updated_deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash).unwrap();
    assert_eq!(updated_deposit.status, DEP_BTC_MINTED_INTO_ABTC);
    assert_eq!(updated_deposit.timestamp, 1234567891);
    assert_eq!(updated_deposit.minted_txn_hash, "minted_txn_hash");
    assert_eq!(updated_deposit.remarks, ""); // Remarks should not be updated after minting
}

#[tokio::test]
#[should_panic(expected = "Only the admin can call this method")]
async fn test_unauthorized_update_deposit() {
    let mut atlas = setup_atlas();
    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        SIGNET.to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );

    // Change context to an unauthorized account (not admin)
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    // This should panic because accounts(2) is not the admin
    atlas.update_deposit_btc_deposited(btc_txn_hash, 1234567891);
}

#[tokio::test]
async fn test_update_deposit_remarks() {
    let mut atlas = setup_atlas();

    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );

    let remarks = "Test remarks".to_string();
    atlas.update_deposit_remarks(btc_txn_hash.clone(), remarks.clone());

    let deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash.clone()).unwrap();
    assert_eq!(deposit.remarks, remarks);
}

#[tokio::test]
#[should_panic(expected = "Deposit record not found")]
async fn test_update_non_existent_deposit() {
    let mut atlas = setup_atlas();
    atlas.update_deposit_btc_deposited("non_existent_hash".to_string(), 1234567891);
}

#[tokio::test]
#[should_panic(expected = "BTC transaction hash cannot be empty")]
async fn test_update_deposit_with_empty_btc_txn_hash() {
    let mut atlas = setup_atlas();
    atlas.update_deposit_btc_deposited("".to_string(), 1234567891);
}

#[tokio::test]
#[should_panic(expected = "Timestamp must be greater than zero")]
async fn test_update_deposit_with_zero_timestamp() {
    let mut atlas = setup_atlas();
    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );
    atlas.update_deposit_btc_deposited(btc_txn_hash, 0);
}

#[tokio::test]
#[should_panic(expected = "Minted transaction hash cannot be empty")]
async fn test_update_deposit_minted_with_empty_minted_txn_hash() {
    let mut atlas = setup_atlas();
    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );
    atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), 1234567891);
    atlas.update_deposit_minted(btc_txn_hash, "".to_string());
}

#[tokio::test]
#[should_panic(expected = "Remarks cannot be blank")]
async fn test_update_deposit_remarks_with_empty_remarks() {
    let mut atlas = setup_atlas();
    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );
    atlas.update_deposit_remarks(btc_txn_hash, "".to_string());
}

#[tokio::test]
async fn test_update_deposit_with_max_timestamp() {
    let mut atlas = setup_atlas();
    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );

    atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), u64::MAX);

    let deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash).unwrap();
    assert_eq!(deposit.timestamp, u64::MAX);
}

#[tokio::test]
async fn test_update_deposit_remarks_with_long_string() {
    let mut atlas = setup_atlas();
    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );

    let long_remarks = "a".repeat(1000);
    atlas.update_deposit_remarks(btc_txn_hash.clone(), long_remarks.clone());

    let deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash).unwrap();
    assert_eq!(deposit.remarks, long_remarks);
}