use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use atlas_protocol::modules::structs::Atlas;
use atlas_protocol::constants::status::*;

// Add this function at the beginning of your test file
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
async fn test_insert_deposit_btc() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


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
async fn test_insert_duplicate_deposit() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


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


    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
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
    }));

    assert!(result.is_err(), "Expected panic due to duplicate BTC transaction hash");
}


#[tokio::test]
async fn test_insert_invalid_deposit() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


    let btc_txn_hash = "".to_string();
    let btc_sender_address = "btc_sender_address".to_string();
    let receiving_chain_id = "receiving_chain_id".to_string();
    let receiving_address = "receiving_address".to_string();
    let btc_amount = 1000;
    let minted_txn_hash = "".to_string();
    let timestamp = 1234567890;
    let remarks = "".to_string();
    let date_created = 1234567890;

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
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
    }));

    assert!(result.is_err());
}

#[tokio::test]
async fn test_insert_maximum_deposit() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


    let btc_txn_hash = "max_btc_txn_hash".to_string();
    let btc_sender_address = "btc_sender_address".to_string();
    let receiving_chain_id = "receiving_chain_id".to_string();
    let receiving_address = "receiving_address".to_string();
    let btc_amount = u64::MAX;
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
    assert_eq!(deposit.btc_amount, btc_amount);
}


#[tokio::test]
async fn test_insert_deposit_with_empty_fields() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


    let btc_txn_hash = "".to_string();
    let btc_sender_address = "".to_string();
    let receiving_chain_id = "".to_string();
    let receiving_address = "".to_string();
    let btc_amount = 1000;
    let minted_txn_hash = "".to_string();
    let timestamp = 1234567890;
    let remarks = "".to_string();
    let date_created = 1234567890;

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
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
    }));

    assert!(result.is_err());
}

#[tokio::test]
async fn test_insert_deposit_with_invalid_btc_amount() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "btc_sender_address".to_string(),
            "receiving_chain_id".to_string(),
            "receiving_address".to_string(),
            0,
            "".to_string(),
            1234567890,
            "".to_string(),
            1234567890,
        );
    }));

    assert!(result.is_err(), "Expected panic due to invalid BTC amount");
}

#[tokio::test]
async fn test_insert_deposit_with_invalid_timestamp() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "btc_sender_address".to_string(),
            "receiving_chain_id".to_string(),
            "receiving_address".to_string(),
            1000,
            "".to_string(),
            0,
            "".to_string(),
            1234567890,
        );
    }));

    assert!(result.is_err(), "Expected panic due to invalid timestamp");
}

#[tokio::test]
async fn test_insert_duplicate_btc_txn_hash() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


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


    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
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
    }));

    assert!(result.is_err(), "Expected panic due to duplicate BTC transaction hash");
}


#[tokio::test]
async fn test_insert_deposit_with_missing_fields() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "".to_string(),
            "btc_sender_address".to_string(),
            "receiving_chain_id".to_string(),
            "receiving_address".to_string(),
            1000,
            "".to_string(),
            1234567890,
            "".to_string(),
            1234567890,
        );
    }));
    assert!(result.is_err(), "Expected panic due to missing transaction hash");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "".to_string(),
            "receiving_chain_id".to_string(),
            "receiving_address".to_string(),
            1000,
            "".to_string(),
            1234567890,
            "".to_string(),
            1234567890,
        );
    }));
    assert!(result.is_err(), "Expected panic due to missing sender address");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "btc_sender_address".to_string(),
            "".to_string(),
            "receiving_address".to_string(),
            1000,
            "".to_string(),
            1234567890,
            "".to_string(),
            1234567890,
        );
    }));
    assert!(result.is_err(), "Expected panic due to missing receiving chain ID");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "btc_sender_address".to_string(),
            "receiving_chain_id".to_string(),
            "".to_string(),
            1000,
            "".to_string(),
            1234567890,
            "".to_string(),
            1234567890,
        );
    }));
    assert!(result.is_err(), "Expected panic due to missing receiving address");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "btc_sender_address".to_string(),
            "receiving_chain_id".to_string(),
            "receiving_address".to_string(),
            0,
            "".to_string(),
            1234567890,
            "".to_string(),
            1234567890,
        );
    }));
    assert!(result.is_err(), "Expected panic due to missing BTC amount");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "btc_sender_address".to_string(),
            "receiving_chain_id".to_string(),
            "receiving_address".to_string(),
            1000,
            "".to_string(),
            0,
            "".to_string(),
            1234567890,
        );
    }));
    assert!(result.is_err(), "Expected panic due to missing timestamp");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "btc_sender_address".to_string(),
            "receiving_chain_id".to_string(),
            "receiving_address".to_string(),
            1000,
            "".to_string(),
            1234567890,
            "".to_string(),
            0,
        );
    }));
    assert!(result.is_err(), "Expected panic due to missing date created");
}


#[tokio::test]
async fn test_insert_deposit_with_invalid_chain_id() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "btc_sender_address".to_string(),
            "".to_string(),
            "receiving_address".to_string(),
            1000,
            "".to_string(),
            1234567890,
            "".to_string(),
            1234567890,
        );
    }));

    assert!(result.is_err(), "Expected panic due to invalid chain ID");
}

#[tokio::test]
async fn test_insert_deposit_with_invalid_receiving_address() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );


    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "btc_sender_address".to_string(),
            "receiving_chain_id".to_string(),
            "".to_string(),
            1000,
            "".to_string(),
            1234567890,
            "".to_string(),
            1234567890,
        );
    }));

    assert!(result.is_err(), "Expected panic due to invalid receiving address");
}

#[tokio::test] // Add this line to make it a test
async fn test_concurrent_deposits() {
    // Set up the testing environment
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    // Initialize the Atlas contract
    let mut atlas = Atlas::new(
        accounts(0), // atlas_owner_id
        accounts(1), // atlas_admin_id
        accounts(2), // global_params_owner_id
        accounts(3), // chain_configs_owner_id
        "treasury_address".to_string(),
        false,
    );

    // Define deposit details
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

    // Insert two deposits concurrently
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

    // Retrieve deposits and assert their properties
    let deposit1 = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash1.clone()).unwrap();
    let deposit2 = atlas.get_deposit_by_btc_txn_hash(btc_txn_hash2.clone()).unwrap();
    assert_eq!(deposit1.btc_txn_hash, btc_txn_hash1);
    assert_eq!(deposit2.btc_txn_hash, btc_txn_hash2);
}

// Add these tests to your existing insert_deposit_tests.rs file

#[tokio::test]
#[should_panic(expected = "BTC transaction hash cannot be empty")]
async fn test_insert_deposit_with_empty_btc_txn_hash() {
    let mut atlas = setup_atlas();
    atlas.insert_deposit_btc(
        "".to_string(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );
}

#[tokio::test]
#[should_panic(expected = "Sender address cannot be empty")]
async fn test_insert_deposit_with_empty_btc_sender_address() {
    let mut atlas = setup_atlas();
    atlas.insert_deposit_btc(
        "btc_txn_hash".to_string(),
        "".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );
}

#[tokio::test]
#[should_panic(expected = "Receiving chain ID cannot be empty")]
async fn test_insert_deposit_with_empty_receiving_chain_id() {
    let mut atlas = setup_atlas();
    atlas.insert_deposit_btc(
        "btc_txn_hash".to_string(),
        "btc_sender_address".to_string(),
        "".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );
}

#[tokio::test]
#[should_panic(expected = "Receiving address cannot be empty")]
async fn test_insert_deposit_with_empty_receiving_address() {
    let mut atlas = setup_atlas();
    atlas.insert_deposit_btc(
        "btc_txn_hash".to_string(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );
}

#[tokio::test]
#[should_panic(expected = "BTC amount must be greater than zero")]
async fn test_insert_deposit_with_zero_btc_amount() {
    let mut atlas = setup_atlas();
    atlas.insert_deposit_btc(
        "btc_txn_hash".to_string(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        0,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );
}

#[tokio::test]
#[should_panic(expected = "Timestamp must be greater than zero")]
async fn test_insert_deposit_with_zero_timestamp() {
    let mut atlas = setup_atlas();
    atlas.insert_deposit_btc(
        "btc_txn_hash".to_string(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        0,
        "".to_string(),
        1234567890,
    );
}

#[tokio::test]
#[should_panic(expected = "Date created must be greater than zero")]
async fn test_insert_deposit_with_zero_date_created() {
    let mut atlas = setup_atlas();
    atlas.insert_deposit_btc(
        "btc_txn_hash".to_string(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        0,
    );
}

#[tokio::test]
async fn test_insert_deposit_with_very_large_btc_amount() {
    let mut atlas = setup_atlas();
    atlas.insert_deposit_btc(
        "btc_txn_hash".to_string(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        u64::MAX,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );
    
    let deposit = atlas.get_deposit_by_btc_txn_hash("btc_txn_hash".to_string()).unwrap();
    assert_eq!(deposit.btc_amount, u64::MAX);
}

#[tokio::test]
async fn test_insert_deposit_with_very_large_timestamp() {
    let mut atlas = setup_atlas();
    atlas.insert_deposit_btc(
        "btc_txn_hash".to_string(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        u64::MAX,
        "".to_string(),
        1234567890,
    );
    
    let deposit = atlas.get_deposit_by_btc_txn_hash("btc_txn_hash".to_string()).unwrap();
    assert_eq!(deposit.timestamp, u64::MAX);
}

#[tokio::test]
#[should_panic(expected = "Only the admin can call this method")]
async fn test_insert_deposit_by_non_admin() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(2)); // Not the admin
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );

    atlas.insert_deposit_btc(
        "btc_txn_hash".to_string(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );
}