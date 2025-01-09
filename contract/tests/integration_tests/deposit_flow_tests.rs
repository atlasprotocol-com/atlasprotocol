use crate::setup::setup_atlas;
use atlas_protocol::constants::status::*;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::{testing_env, Promise};
use near_sdk::{PromiseOrValue, PromiseResult};

#[tokio::test]
async fn test_deposit_flow_evm() {
    let mut atlas = setup_atlas();

    // 1. Insert a deposit
    let btc_txn_hash =
        "cd5760b19bf4684388f738917514d170145c839916b7dcc675c6da36bb81c979".to_string();
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "tb1qvg6mywtj0zdreskfflv838kxdy3q438t86dj5v".to_string(),
        "421614".to_string(),
        "0x2564186c643B292d6A4215f5C33Aa69b213414dd".to_string(),
        1000,
        0,
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
        .predecessor_account_id(accounts(1))
        .build());
    atlas.increment_deposit_verified_count(deposit.clone());
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(2))
        .build());
    atlas.increment_deposit_verified_count(deposit.clone());

    // 4. Mint abtc
    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.verified_count, 2);

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .block_timestamp(1234567890)
        .build());
    atlas.create_mint_abtc_signed_tx(deposit.btc_txn_hash.clone(), 94, 5000000, 100000000, 0);
    
    // 5. Update minted txn hash
    let minted_txn_hash = "0x511d02e4a7dc5319a339050a405f40a6ff17ad68dce7f9cb0e3d0cf549c6acbf".to_string();
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.update_deposit_minted_txn_hash(
        btc_txn_hash.clone(),
        minted_txn_hash.clone(),
    );

    // 6. Verify minted txn hash by validators
    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.status, DEP_BTC_PENDING_MINTED_INTO_ABTC);

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.increment_deposit_minted_txn_hash_verified_count(btc_txn_hash.clone(), minted_txn_hash.clone());
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(2))
        .build());
    atlas.increment_deposit_minted_txn_hash_verified_count(btc_txn_hash.clone(), minted_txn_hash.clone());
    
    // 7. Update deposit to minted status
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.update_deposit_minted(
        btc_txn_hash.clone(),
        minted_txn_hash.clone(),
    );

    // 8. Verify final state
    let final_deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash).unwrap();
    assert_eq!(final_deposit.status, DEP_BTC_MINTED_INTO_ABTC);
    assert_eq!(final_deposit.minted_txn_hash, minted_txn_hash);
    assert_eq!(final_deposit.verified_count, 2);
    assert_eq!(final_deposit.minted_txn_hash_verified_count, 2);
}

#[tokio::test]
async fn test_deposit_flow_near() {
    let mut atlas = setup_atlas();

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
        1000,
        0,
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
        .predecessor_account_id(accounts(1))
        .build());
    atlas.increment_deposit_verified_count(deposit.clone());
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(2))
        .build());
    atlas.increment_deposit_verified_count(deposit);

    // 4. Mint abtc
    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.verified_count, 2);

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .block_timestamp(1234567890)
        .build());
    atlas.create_mint_abtc_signed_tx(deposit.btc_txn_hash.clone(), 94, 5000000, 100000000, 0);

    // 5. Update minted txn hash
    let minted_txn_hash = "25YpMdT51NiUzHGpnpJMJtwdboAe91YBMFEGo3GCwyRq".to_string();
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.update_deposit_minted_txn_hash(
        btc_txn_hash.clone(),
        minted_txn_hash.clone(),
    );
    
    // 6. Verify minted txn hash by validators
    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.status, DEP_BTC_PENDING_MINTED_INTO_ABTC);

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.increment_deposit_minted_txn_hash_verified_count(btc_txn_hash.clone(), minted_txn_hash.clone());
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(2))
        .build());
    atlas.increment_deposit_minted_txn_hash_verified_count(btc_txn_hash.clone(), minted_txn_hash.clone());
    
    // 7. Update deposit to minted status
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.update_deposit_minted(
        btc_txn_hash.clone(),
        minted_txn_hash.clone(),
    );

    // 8. Verify final state
    let final_deposit = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash).unwrap();
    assert_eq!(final_deposit.status, DEP_BTC_MINTED_INTO_ABTC);
    assert_eq!(final_deposit.minted_txn_hash, minted_txn_hash);
    assert_eq!(final_deposit.verified_count, 2);
    assert_eq!(final_deposit.minted_txn_hash_verified_count, 2);
}
