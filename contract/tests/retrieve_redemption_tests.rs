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
async fn test_get_redemption_by_txn_hash() {
    let mut atlas = setup_atlas();

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

    let redemption = atlas.get_redemption_by_txn_hash(txn_hash.clone()).unwrap();
    assert_eq!(redemption.txn_hash, txn_hash);
    assert_eq!(redemption.status, RED_ABTC_BURNT);
}

#[tokio::test]
async fn test_get_redemption_by_nonexistent_txn_hash() {
    let atlas = setup_atlas();

    let result = atlas.get_redemption_by_txn_hash("nonexistent_hash".to_string());
    assert!(result.is_none(), "Expected None for non-existent redemption");
}

#[tokio::test]
async fn test_get_redemptions_by_abtc_redemption_address() {
    let mut atlas = setup_atlas();

    let address = "0x1234567890123456789012345678901234567890".to_string();
    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        address.clone(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );
    atlas.insert_redemption_abtc(
        "421614,0xfedcba0987654321".to_string(),
        address.clone(),
        "421614".to_string(),
        "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7".to_string(),
        2000,
        1625097700,
        1625097700,
    );

    let redemptions = atlas.get_redemptions_by_abtc_redemption_address(address);
    assert_eq!(redemptions.len(), 2);
}

#[tokio::test]
async fn test_get_redemptions_by_btc_receiving_address() {
    let mut atlas = setup_atlas();

    let address = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string();
    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        address.clone(),
        1000,
        1625097600,
        1625097600,
    );

    let redemptions = atlas.get_redemptions_by_btc_receiving_address(address);
    assert_eq!(redemptions.len(), 1);
}

#[tokio::test]
async fn test_get_redemptions_by_timestamp() {
    let mut atlas = setup_atlas();

    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );
    atlas.insert_redemption_abtc(
        "421614,0xfedcba0987654321".to_string(),
        "0x0987654321098765432109876543210987654321".to_string(),
        "421614".to_string(),
        "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7".to_string(),
        2000,
        1625097700,
        1625097700,
    );

    let redemptions = atlas.get_redemptions_by_timestamp(1625097500, 1625097650);
    assert_eq!(redemptions.len(), 1);

    let all_redemptions = atlas.get_redemptions_by_timestamp(1625097500, 1625097800);
    assert_eq!(all_redemptions.len(), 2);
}

#[tokio::test]
async fn test_get_all_redemptions() {
    let mut atlas = setup_atlas();

    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );
    atlas.insert_redemption_abtc(
        "421614,0xfedcba0987654321".to_string(),
        "0x0987654321098765432109876543210987654321".to_string(),
        "421614".to_string(),
        "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7".to_string(),
        2000,
        1625097700,
        1625097700,
    );

    let all_redemptions = atlas.get_all_redemptions();
    assert_eq!(all_redemptions.len(), 2);
}

#[tokio::test]
async fn test_get_redemptions_count() {
    let mut atlas = setup_atlas();

    assert_eq!(atlas.get_redemptions_count(), 0);

    atlas.insert_redemption_abtc(
        "421614,0x1234567890abcdef".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
        "421614".to_string(),
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string(),
        1000,
        1625097600,
        1625097600,
    );

    assert_eq!(atlas.get_redemptions_count(), 1);
}

#[tokio::test]
async fn test_get_redemptions_with_empty_result() {
    let atlas = setup_atlas();

    let redemptions = atlas.get_redemptions_by_abtc_redemption_address("0x1234567890123456789012345678901234567890".to_string());
    assert!(redemptions.is_empty(), "Expected empty result for non-existent address");

    let redemptions = atlas.get_redemptions_by_btc_receiving_address("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx".to_string());
    assert!(redemptions.is_empty(), "Expected empty result for non-existent address");

    let redemptions = atlas.get_redemptions_by_timestamp(1625097500, 1625097800);
    assert!(redemptions.is_empty(), "Expected empty result for time range with no redemptions");
}

// New negative validation tests

#[tokio::test]
#[should_panic(expected = "Transaction hash cannot be empty")]
async fn test_get_redemption_by_empty_txn_hash() {
    let atlas = setup_atlas();
    atlas.get_redemption_by_txn_hash("".to_string());
}

#[tokio::test]
#[should_panic(expected = "atBTC redemption address cannot be empty")]
async fn test_get_redemptions_by_empty_abtc_redemption_address() {
    let atlas = setup_atlas();
    atlas.get_redemptions_by_abtc_redemption_address("".to_string());
}

#[tokio::test]
#[should_panic(expected = "BTC receiving address cannot be empty")]
async fn test_get_redemptions_by_empty_btc_receiving_address() {
    let atlas = setup_atlas();
    atlas.get_redemptions_by_btc_receiving_address("".to_string());
}

#[tokio::test]
#[should_panic(expected = "Start time must be less than or equal to end time")]
async fn test_get_redemptions_by_invalid_timestamp_range() {
    let atlas = setup_atlas();
    atlas.get_redemptions_by_timestamp(1625097800, 1625097500); // end time before start time
}

#[tokio::test]
async fn test_get_redemptions_by_future_timestamp() {
    let atlas = setup_atlas();
    let far_future = 32503680000; // Year 3000
    let redemptions = atlas.get_redemptions_by_timestamp(far_future, far_future + 1000);
    assert!(redemptions.is_empty(), "Expected no redemptions in the far future");
}

#[tokio::test]
async fn test_get_redemptions_with_malformed_addresses() {
    let atlas = setup_atlas();
    
    let invalid_eth_address = "0xinvalid_address".to_string();
    let redemptions = atlas.get_redemptions_by_abtc_redemption_address(invalid_eth_address);
    assert!(redemptions.is_empty(), "Expected no redemptions for invalid ETH address");

    let invalid_btc_address = "invalid_btc_address".to_string();
    let redemptions = atlas.get_redemptions_by_btc_receiving_address(invalid_btc_address);
    assert!(redemptions.is_empty(), "Expected no redemptions for invalid BTC address");
}

#[tokio::test]
async fn test_get_redemptions_with_very_large_timestamp() {
    let atlas = setup_atlas();
    let very_large_timestamp = u64::MAX;
    let redemptions = atlas.get_redemptions_by_timestamp(very_large_timestamp - 1000, very_large_timestamp);
    assert!(redemptions.is_empty(), "Expected no redemptions for very large timestamp");
}

#[tokio::test]
async fn test_get_all_redemptions_with_empty_state() {
    let atlas = setup_atlas();
    let all_redemptions = atlas.get_all_redemptions();
    assert!(all_redemptions.is_empty(), "Expected no redemptions in empty state");
}

#[tokio::test]
async fn test_get_redemptions_count_with_empty_state() {
    let atlas = setup_atlas();
    assert_eq!(atlas.get_redemptions_count(), 0, "Expected redemption count to be 0 in empty state");
}