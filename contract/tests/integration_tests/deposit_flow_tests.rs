use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use atlas_protocol::constants::status::*;
use crate::setup::setup_atlas;


#[tokio::test]
async fn test_deposit_flow() {
    let mut atlas = setup_atlas();

    // 1. Insert a deposit
    let btc_txn_hash = "btc_txn_hash".to_string();
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        "SIGNET".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );

    // 2. Update deposit status to BTC_DEPOSITED
    atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), 1234567891);

    // 3. Verify deposit by validators
    let deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash.clone()).unwrap();
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.increment_deposit_verified_count(deposit.clone());
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(2)).build());
    atlas.increment_deposit_verified_count(deposit);

    // 4. Update deposit to minted status
    testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
    atlas.update_deposit_minted(btc_txn_hash.clone(), "minted_txn_hash".to_string());

    // 5. Verify final state
    let final_deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash).unwrap();
    assert_eq!(final_deposit.status, DEP_BTC_MINTED_INTO_ABTC);
    assert_eq!(final_deposit.minted_txn_hash, "minted_txn_hash");
    assert_eq!(final_deposit.verified_count, 2);
}