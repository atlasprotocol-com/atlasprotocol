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
    )
}

#[tokio::test]
async fn test_insert_redemption_abtc() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    let txn_hash = "421614,0x1234567890abcdef".to_string();
    let abtc_redemption_address = "0x1234567890123456789012345678901234567890".to_string();
    let abtc_redemption_chain_id = "421614".to_string();
    let btc_receiving_address = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string();
    let abtc_amount = 1000;
    let timestamp = 1625097600;
    let date_created = 1625097600;

    atlas.insert_redemption_abtc(
        txn_hash.clone(),
        abtc_redemption_address.clone(),
        abtc_redemption_chain_id.clone(),
        btc_receiving_address.clone(),
        abtc_amount,
        timestamp,
        date_created,
    );

    let redemption = atlas.get_redemption_by_txn_hash(txn_hash.clone()).unwrap();
    assert_eq!(redemption.txn_hash, txn_hash);
    assert_eq!(redemption.abtc_redemption_address, abtc_redemption_address);
    assert_eq!(redemption.abtc_redemption_chain_id, abtc_redemption_chain_id);
    assert_eq!(redemption.btc_receiving_address, btc_receiving_address);
    assert_eq!(redemption.abtc_amount, abtc_amount);
    assert_eq!(redemption.timestamp, timestamp);
    assert_eq!(redemption.status, RED_ABTC_BURNT);
    assert_eq!(redemption.remarks, "");
    assert_eq!(redemption.date_created, date_created);
    assert_eq!(redemption.verified_count, 0);
    assert_eq!(redemption.yield_provider_txn_hash, "");
}


#[tokio::test]
async fn test_insert_duplicate_redemption() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

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

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_redemption_abtc(
            txn_hash.clone(),
            "0x1234567890123456789012345678901234567890".to_string(),
            "421614".to_string(),
            "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
            1000,
            1625097600,
            1625097600,
        );
    }));

    assert!(result.is_err(), "Expected panic due to duplicate transaction hash");
}

#[tokio::test]
async fn test_insert_redemption_with_invalid_data() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_redemption_abtc(
            "".to_string(), // Empty txn_hash
            "0x1234567890123456789012345678901234567890".to_string(),
            "421614".to_string(),
            "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
            1000,
            1625097600,
            1625097600,
        );
    }));

    assert!(result.is_err(), "Expected panic due to empty transaction hash");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_redemption_abtc(
            "421614,0x1234567890abcdef".to_string(),
            "".to_string(), // Empty abtc_redemption_address
            "421614".to_string(),
            "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
            1000,
            1625097600,
            1625097600,
        );
    }));

    assert!(result.is_err(), "Expected panic due to empty abtc_redemption_address");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_redemption_abtc(
            "421614,0x1234567890abcdef".to_string(),
            "0x1234567890123456789012345678901234567890".to_string(),
            "421614".to_string(),
            "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
            0, // Zero abtc_amount
            1625097600,
            1625097600,
        );
    }));

    assert!(result.is_err(), "Expected panic due to zero abtc_amount");
}

#[tokio::test]
async fn test_insert_redemption_unauthorized() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(2)); // Not the admin
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_redemption_abtc(
            "421614,0x1234567890abcdef".to_string(),
            "0x1234567890123456789012345678901234567890".to_string(),
            "421614".to_string(),
            "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
            1000,
            1625097600,
            1625097600,
        );
    }));

    assert!(result.is_err(), "Expected panic due to unauthorized access");
}

#[tokio::test]
async fn test_insert_multiple_redemptions() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    let txn_hash1 = "421614,0x1234567890abcdef".to_string();
    let txn_hash2 = "421614,0xfedcba0987654321".to_string();

    atlas.insert_redemption_abtc(
        txn_hash1.clone(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );

    atlas.insert_redemption_abtc(
        txn_hash2.clone(),
        "0x0987654321098765432109876543210987654321".to_string(),
        "421614".to_string(),
        "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7".to_string(),
        2000,
        1625097700,
        1625097700,
    );

    assert!(atlas.get_redemption_by_txn_hash(txn_hash1).is_some());
    assert!(atlas.get_redemption_by_txn_hash(txn_hash2).is_some());
    assert_eq!(atlas.get_redemptions_count(), 2);
}

// New negative validation tests

#[tokio::test]
#[should_panic(expected = "Transaction hash cannot be empty")]
async fn test_insert_redemption_with_empty_txn_hash() {
    let mut atlas = setup_atlas();
    atlas.insert_redemption_abtc(
        "".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );
}

#[tokio::test]
#[should_panic(expected = "atBTC redemption address cannot be empty")]
async fn test_insert_redemption_with_empty_abtc_redemption_address() {
    let mut atlas = setup_atlas();
    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );
}

#[tokio::test]
#[should_panic(expected = "atBTC redemption chain ID cannot be empty")]
async fn test_insert_redemption_with_empty_abtc_redemption_chain_id() {
    let mut atlas = setup_atlas();
    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );
}

#[tokio::test]
#[should_panic(expected = "BTC receiving address cannot be empty")]
async fn test_insert_redemption_with_empty_btc_receiving_address() {
    let mut atlas = setup_atlas();
    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "".to_string(),
        1000,
        1625097600,
        1625097600,
    );
}

#[tokio::test]
#[should_panic(expected = "atBTC amount must be greater than zero")]
async fn test_insert_redemption_with_zero_abtc_amount() {
    let mut atlas = setup_atlas();
    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        0,
        1625097600,
        1625097600,
    );
}

#[tokio::test]
#[should_panic(expected = "Timestamp must be greater than zero")]
async fn test_insert_redemption_with_zero_timestamp() {
    let mut atlas = setup_atlas();
    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        0,
        1625097600,
    );
}

#[tokio::test]
#[should_panic(expected = "Date created must be greater than zero")]
async fn test_insert_redemption_with_zero_date_created() {
    let mut atlas = setup_atlas();
    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        0,
    );
}

#[tokio::test]
async fn test_insert_redemption_with_very_large_abtc_amount() {
    let mut atlas = setup_atlas();
    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        u64::MAX,
        1625097600,
        1625097600,
    );
    
    let redemption = atlas.get_redemption_by_txn_hash("421614,0x1234567890abcdef".to_string()).unwrap();
    assert_eq!(redemption.abtc_amount, u64::MAX);
}

#[tokio::test]
async fn test_insert_redemption_with_very_large_timestamp() {
    let mut atlas = setup_atlas();
    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        u64::MAX,
        1625097600,
    );
    
    let redemption = atlas.get_redemption_by_txn_hash("421614,0x1234567890abcdef".to_string()).unwrap();
    assert_eq!(redemption.timestamp, u64::MAX);
}

#[tokio::test]
#[should_panic(expected = "Only the admin can call this method")]
async fn test_insert_redemption_by_non_admin() {
    let mut context = VMContextBuilder::new();
    
    let mut atlas = setup_atlas();

    context.predecessor_account_id(accounts(2)); // Not the admin
    testing_env!(context.build());

    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );
}