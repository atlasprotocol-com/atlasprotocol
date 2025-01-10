use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use atlas_protocol::constants::status::*;
use crate::setup::setup_atlas;
use atlas_protocol::constants::status::RED_BTC_REDEEMED_BACK_TO_USER;

#[tokio::test]
async fn test_redemption_flow() {
    let mut atlas = setup_atlas();

    // 1. Insert a redemption
    let txn_hash = "421614,0x1234567890abcdef".to_string();
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.insert_redemption_abtc(
        txn_hash.clone(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );
    

    // 2. Verify redemption by validators
    let redemption = atlas.get_redemption_by_txn_hash(txn_hash.clone()).unwrap();
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.increment_redemption_verified_count(redemption.clone());
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    atlas.increment_redemption_verified_count(redemption);

    // 3. Update redemption status to RED_BTC_PENDING_MEMPOOL_CONFIRMATION
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.update_redemption_start(txn_hash.clone());
    atlas.update_redemption_pending_btc_mempool(txn_hash.clone(), "btc_txn_hash".to_string());

    // 4. Verify btc_txn_hash by validators
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.increment_redemption_btc_txn_hash_verified_count(txn_hash.clone(), "btc_txn_hash".to_string());
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    atlas.increment_redemption_btc_txn_hash_verified_count(txn_hash.clone(), "btc_txn_hash".to_string());

    // 5. Update redemption status to RED_BTC_REDEEMED_BACK_TO_USER
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.update_redemption_redeemed(txn_hash.clone(), "btc_txn_hash".to_string(), 1625097700);

    // 6. Verify final state
    let final_redemption = atlas.get_redemption_by_txn_hash(txn_hash.clone()).unwrap();
    assert_eq!(final_redemption.status, RED_BTC_REDEEMED_BACK_TO_USER);
    assert_eq!(final_redemption.btc_txn_hash, "btc_txn_hash");
    assert_eq!(final_redemption.verified_count, 2);
    assert_eq!(final_redemption.btc_txn_hash_verified_count, 2);
}