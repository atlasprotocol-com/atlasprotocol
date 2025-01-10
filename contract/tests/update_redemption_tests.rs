use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use atlas_protocol::modules::structs::Atlas;
use atlas_protocol::constants::status::*;

fn setup_atlas() -> Atlas {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));  // Set the predecessor to the owner account
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),  // owner
        accounts(1),  // admin
        accounts(2),  // global_params_owner
        accounts(3),  // chain_configs_owner
        "treasury_address".to_string(),
        false,
    );

    // Add two validators for the test chains
    atlas.add_validator(accounts(1), "SIGNET".to_string());
    atlas.add_validator(accounts(2), "SIGNET".to_string());
    atlas.add_validator(accounts(1), "421614".to_string());
    atlas.add_validator(accounts(2), "421614".to_string());
    atlas.add_validator(accounts(1), "NEAR_TESTNET".to_string());
    atlas.add_validator(accounts(2), "NEAR_TESTNET".to_string());

    atlas
}

fn insert_test_redemption(atlas: &mut Atlas) -> String {
    // Set the context to admin account before inserting redemption
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());

    let txn_hash = "421614,0x1234567890abcdef".to_string();
    atlas.insert_redemption_abtc(
        txn_hash.clone(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );

    // Simulate verification by two different validators
    let redemption = atlas.get_redemption_by_txn_hash(txn_hash.clone()).unwrap();
    
    // First validator verification
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.increment_redemption_verified_count(redemption.clone());
    let updated_redemption = atlas.get_redemption_by_txn_hash(txn_hash.clone()).unwrap();
    assert_eq!(updated_redemption.verified_count, 1, "Verified count should be 1 after first validation");

    // Second validator verification
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    atlas.increment_redemption_verified_count(updated_redemption);
    let final_redemption = atlas.get_redemption_by_txn_hash(txn_hash.clone()).unwrap();
    assert_eq!(final_redemption.verified_count, 2, "Verified count should be 2 after second validation");

    // Set the predecessor back to the admin account
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    
    txn_hash
}

// Update all test functions to use the correct admin account (accounts(1))
// Here's an example of how to update a test function:

#[tokio::test]
async fn test_update_redemption_start() {
    let mut atlas = setup_atlas();
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    let txn_hash = insert_test_redemption(&mut atlas);
    atlas.update_redemption_start(txn_hash.clone());
    let updated_redemption = atlas.get_redemption_by_txn_hash(txn_hash).unwrap();
    assert_eq!(updated_redemption.status, RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER);
}

// Update all other test functions similarly, ensuring that the admin account (accounts(1)) is set before making admin-only calls

// For panic tests, update them like this:

#[tokio::test]
#[should_panic(expected = "Only the admin can call this method")]
async fn test_unauthorized_update_redemption() {
    let mut atlas = setup_atlas();
    let txn_hash = insert_test_redemption(&mut atlas);

    // Change context to an unauthorized account (not admin)
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    
    // This should panic because accounts(2) is not the admin
    atlas.update_redemption_start(txn_hash);
}

// ... (update all other test functions)

#[tokio::test]
async fn test_update_redemption_pending_btc_mempool() {
    let mut atlas = setup_atlas();
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());

    let txn_hash = insert_test_redemption(&mut atlas);

    atlas.update_redemption_start(txn_hash.clone());
    
    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.update_redemption_pending_btc_mempool(txn_hash.clone(), btc_txn_hash.clone());

    let updated_redemption = atlas.get_redemption_by_txn_hash(txn_hash).unwrap();
    assert_eq!(updated_redemption.status, RED_BTC_PENDING_MEMPOOL_CONFIRMATION);
    assert_eq!(updated_redemption.btc_txn_hash, btc_txn_hash);
}

#[tokio::test]
async fn test_update_redemption_redeemed() {
    let mut atlas = setup_atlas();

    // Set the predecessor to the admin account
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());

    let txn_hash = insert_test_redemption(&mut atlas);    

    atlas.update_redemption_start(txn_hash.clone());

    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.update_redemption_pending_btc_mempool(txn_hash.clone(), btc_txn_hash.clone());
    
    // verify btc_txn_hash by validators
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.increment_redemption_btc_txn_hash_verified_count(txn_hash.clone(), btc_txn_hash.clone());
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    atlas.increment_redemption_btc_txn_hash_verified_count(txn_hash.clone(), btc_txn_hash.clone());

    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    let new_timestamp = 1625097700;
    atlas.update_redemption_redeemed(txn_hash.clone(), btc_txn_hash.clone(), new_timestamp);

    let updated_redemption = atlas.get_redemption_by_txn_hash(txn_hash).unwrap();
    assert_eq!(updated_redemption.status, RED_BTC_REDEEMED_BACK_TO_USER);
    assert_eq!(updated_redemption.btc_txn_hash, btc_txn_hash);
    assert_eq!(updated_redemption.timestamp, new_timestamp);
    assert_eq!(updated_redemption.btc_txn_hash_verified_count, 2);
}

#[tokio::test]
async fn test_update_redemption_custody_txn_id() {
    let mut atlas = setup_atlas();
    let txn_hash = insert_test_redemption(&mut atlas);

    // Update redemption status to RED_BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER
    atlas.update_redemption_start(txn_hash.clone());

    let custody_txn_id = "custody_txn_id".to_string();
    atlas.update_redemption_custody_txn_id(txn_hash.clone(), custody_txn_id.clone());

    let updated_redemption = atlas.get_redemption_by_txn_hash(txn_hash).unwrap();
    assert_eq!(updated_redemption.custody_txn_id, custody_txn_id);
}

#[tokio::test]
async fn test_update_redemption_remarks() {
    let mut atlas = setup_atlas();
    let txn_hash = insert_test_redemption(&mut atlas);

    let remarks = "Test remarks".to_string();
    atlas.update_redemption_remarks(txn_hash.clone(), remarks.clone());

    let updated_redemption = atlas.get_redemption_by_txn_hash(txn_hash).unwrap();
    assert_eq!(updated_redemption.remarks, remarks);
}

#[tokio::test]
#[should_panic(expected = "Only the admin can call this method")]
async fn test_unauthorized_update_redemption_start() {
    let mut atlas = setup_atlas();
    let txn_hash = insert_test_redemption(&mut atlas);

    // Change context to non-admin (use accounts(2) instead of accounts(1))
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());

    atlas.update_redemption_start(txn_hash);
}

#[tokio::test]
#[should_panic(expected = "Transaction hash cannot be empty")]
async fn test_update_redemption_start_with_empty_txn_hash() {
    let mut atlas = setup_atlas();

    // Set the predecessor to the admin account
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());

    atlas.update_redemption_start("".to_string());
}

#[tokio::test]
#[should_panic(expected = "Redemption record not found")]
async fn test_update_nonexistent_redemption() {
    let mut atlas = setup_atlas();
    // Set the predecessor to the admin account
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.update_redemption_start("non_existent_hash".to_string());
}

#[tokio::test]
#[should_panic(expected = "Conditions not met for updating redemption status")]
async fn test_update_redemption_with_invalid_status_transition() {
    let mut atlas = setup_atlas();

    // Set the predecessor to the admin account
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());

    let txn_hash = insert_test_redemption(&mut atlas);

    // Try to update to redeemed without going through the proper status transitions
    atlas.update_redemption_redeemed(txn_hash, "btc_txn_hash".to_string(), 1625097700);
}

#[tokio::test]
#[should_panic(expected = "Redemption record not found")]
async fn test_update_non_existent_redemption() {
    let mut atlas = setup_atlas();
    // Set the predecessor to the admin account
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.update_redemption_start("non_existent_hash".to_string());
}

#[tokio::test]
#[should_panic(expected = "Transaction hash cannot be empty")]
async fn test_update_redemption_with_empty_txn_hash() {
    let mut atlas = setup_atlas();
    // Set the predecessor to the admin account
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.update_redemption_start("".to_string());
}

#[tokio::test]
async fn test_update_redemption_multiple_times() {
    let mut atlas = setup_atlas();
    let txn_hash = insert_test_redemption(&mut atlas);

    atlas.update_redemption_start(txn_hash.clone());
    
    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.update_redemption_pending_btc_mempool(txn_hash.clone(), btc_txn_hash.clone());

    // verify btc_txn_hash by validators
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.increment_redemption_btc_txn_hash_verified_count(txn_hash.clone(), btc_txn_hash.clone());
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    atlas.increment_redemption_btc_txn_hash_verified_count(txn_hash.clone(), btc_txn_hash.clone());

    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    let new_timestamp = 1625097700;
    atlas.update_redemption_redeemed(txn_hash.clone(), btc_txn_hash.clone(), new_timestamp);

    let updated_redemption = atlas.get_redemption_by_txn_hash(txn_hash).unwrap();
    assert_eq!(updated_redemption.status, RED_BTC_REDEEMED_BACK_TO_USER);
    assert_eq!(updated_redemption.btc_txn_hash, btc_txn_hash);
    assert_eq!(updated_redemption.timestamp, new_timestamp);
    assert_eq!(updated_redemption.btc_txn_hash_verified_count, 2);
}

#[tokio::test]
#[should_panic(expected = "Conditions not met for updating redemption status")]
async fn test_update_redemption_invalid_state_transition() {
    let mut atlas = setup_atlas();
    let txn_hash = insert_test_redemption(&mut atlas);

    // Try to update to redeemed without going through the proper status transitions
    atlas.update_redemption_redeemed(txn_hash, "btc_txn_hash".to_string(), 1625097700);
}

#[tokio::test]
async fn test_update_redemption_with_max_timestamp() {
    let mut atlas = setup_atlas();
    let txn_hash = insert_test_redemption(&mut atlas);

    atlas.update_redemption_start(txn_hash.clone());

    let btc_txn_hash = "btc_txn_hash".to_string();
    atlas.update_redemption_pending_btc_mempool(txn_hash.clone(), btc_txn_hash.clone());

    // verify btc_txn_hash by validators
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.increment_redemption_btc_txn_hash_verified_count(txn_hash.clone(), btc_txn_hash.clone());
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    atlas.increment_redemption_btc_txn_hash_verified_count(txn_hash.clone(), btc_txn_hash.clone());

    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.update_redemption_redeemed(txn_hash.clone(), btc_txn_hash.clone(), u64::MAX);

    let updated_redemption = atlas.get_redemption_by_txn_hash(txn_hash).unwrap();
    assert_eq!(updated_redemption.timestamp, u64::MAX);
    assert_eq!(updated_redemption.btc_txn_hash_verified_count, 2);
}

#[tokio::test]
async fn test_update_redemption_remarks_with_long_string() {
    let mut atlas = setup_atlas();
    let txn_hash = insert_test_redemption(&mut atlas);

    let long_remarks = "a".repeat(1000);
    atlas.update_redemption_remarks(txn_hash.clone(), long_remarks.clone());

    let updated_redemption = atlas.get_redemption_by_txn_hash(txn_hash).unwrap();
    assert_eq!(updated_redemption.remarks, long_remarks);
}