use atlas_protocol::chain_configs::ChainConfigRecord;
use atlas_protocol::constants::network_type::SIGNET;
use atlas_protocol::constants::status::*;
use atlas_protocol::modules::structs::Atlas;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
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
        false,
    );

    // Set up chain configs
    let chain_config_json = json!({
        "chains": [
            {
                "chain_id": "SIGNET",
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
            },
            {
              "chain_id": "NEAR_TESTNET",
              "network_type": "NEAR",
              "network_name": "NEAR testnet",
              "chain_rpc_url": "https://rpc.testnet.near.org",
              "explorer_url": "https://testnet.nearblocks.io/",
              "abtc_address": "atbtc_audit.velar.testnet",
              "native_currency_name": "NEAR",
              "native_currency_decimals": 18,
              "native_currency_symbol": "NEAR",
              "first_block": 0,
              "batch_size": 10000,
              "gas_limit": 0,
              "abi_path": "",
              "validators_threshold": 2
            },
            {
                "chain_id": "421614",
                "network_type": "EVM",
                "network_name": "Arbitrum Sepolia",
                "chain_rpc_url": "https://sepolia-rollup.arbitrum.io/rpc",
                "explorer_url": "https://sepolia.arbiscan.io/",
                "abtc_address": "0xDD5537E12d80484D30ef9EF38596424369Ed821a",
                "native_currency_name": "ETH",
                "native_currency_decimals": 18,
                "native_currency_symbol": "ETH",
                "first_block": 67300000,
                "batch_size": 50000,
                "gas_limit": 5000000,
                "abi_path": "../../contract/artifacts/atBTC.abi",
                "validators_threshold": 2
            }
        ]
    })
    .to_string();

    // Set chain configs using the JSON string
    // Change the context to accounts(3) before setting chain configs
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(3))
        .build());
    atlas.set_chain_configs_from_json(chain_config_json);

    // Add two validators for SIGNET
    // Change the context back to accounts(0) for adding validators
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(0))
        .build());
    atlas.add_validator(accounts(1), "SIGNET".to_string());
    atlas.add_validator(accounts(2), "SIGNET".to_string());
    atlas.add_validator(accounts(1), "421614".to_string());
    atlas.add_validator(accounts(2), "421614".to_string());
    atlas.add_validator(accounts(1), "NEAR_TESTNET".to_string());
    atlas.add_validator(accounts(2), "NEAR_TESTNET".to_string());
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
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

    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.status, DEP_BTC_DEPOSITED_INTO_ATLAS);
    assert_eq!(deposit.timestamp, new_timestamp);
}

#[tokio::test]
async fn test_update_deposit_minted() {
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

    // 3. Verify deposit by validators
    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.verified_count, 2);

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .block_timestamp(1234567001 * 1_000_000_000)
        .build());
    atlas.create_mint_abtc_signed_tx(deposit.btc_txn_hash.clone(), 94, 5000000, 100000000, 0);

    // 4. Update deposit to minted status
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.update_deposit_minted(
        btc_txn_hash.clone(),
        "0x511d02e4a7dc5319a339050a405f40a6ff17ad68dce7f9cb0e3d0cf549c6acbf".to_string(),
    );

    let updated_deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(updated_deposit.status, DEP_BTC_MINTED_INTO_ABTC);
    assert_eq!(
        updated_deposit.minted_txn_hash,
        "0x511d02e4a7dc5319a339050a405f40a6ff17ad68dce7f9cb0e3d0cf549c6acbf"
    );
}

#[tokio::test]
async fn test_update_deposit_multiple_times() {
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

    // 3. Verify deposit by validators
    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.verified_count, 2);

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .block_timestamp(1234567001 * 1_000_000_000)
        .build());
    atlas.create_mint_abtc_signed_tx(deposit.btc_txn_hash.clone(), 94, 5000000, 100000000, 0);

    // 4. Update deposit to minted status
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.update_deposit_minted(
        btc_txn_hash.clone(),
        "0x511d02e4a7dc5319a339050a405f40a6ff17ad68dce7f9cb0e3d0cf549c6acbf".to_string(),
    );

    // Try to update remarks after minting (this should not change the remarks)
    atlas.update_deposit_remarks(btc_txn_hash.clone(), "Updated remarks".to_string());

    let updated_deposit: atlas_protocol::DepositRecord =
        atlas.get_deposit_by_btc_txn_hash(btc_txn_hash).unwrap();
    assert_eq!(updated_deposit.status, DEP_BTC_MINTED_INTO_ABTC);
    assert_eq!(updated_deposit.timestamp, 1234567001);
    assert_eq!(
        updated_deposit.minted_txn_hash,
        "0x511d02e4a7dc5319a339050a405f40a6ff17ad68dce7f9cb0e3d0cf549c6acbf"
    );
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
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(2))
        .build());
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

    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
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
