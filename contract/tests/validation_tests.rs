use atlas_protocol::constants::status::*;
use atlas_protocol::modules::structs::Atlas;
use atlas_protocol::modules::structs::DepositRecord;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use near_sdk::AccountId;

fn setup_atlas() -> (Atlas, AccountId) {
    let mut context = VMContextBuilder::new();
    let owner_account = accounts(0);
    context.predecessor_account_id(owner_account.clone());
    testing_env!(context.build());

    let atlas = Atlas::new(
        owner_account.clone(),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
        false,
    );

    (atlas, owner_account)
}

#[tokio::test]
async fn test_deposit_verification() {
    let (mut atlas, _) = setup_atlas();

    let signet_chain_config = atlas.chain_configs.get_chain_config("SIGNET".to_string());
    assert!(
        signet_chain_config.is_some(),
        "SIGNET chain configuration should be present"
    );

    atlas.add_validator(accounts(1), "SIGNET".to_string());

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());

    let btc_txn_hash = "btc_txn_hash".to_string();
    let btc_sender_address = "btc_sender_address".to_string();
    let receiving_chain_id = "SIGNET".to_string();
    let receiving_address = "receiving_address".to_string();
    let btc_amount = 1000;
    let fee_amount = 0;
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
        fee_amount,
        minted_txn_hash.clone(),
        timestamp,
        remarks.clone(),
        date_created,
    );

    atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), timestamp);

    let mempool_deposit = DepositRecord {
        btc_txn_hash: btc_txn_hash.clone(),
        btc_sender_address: btc_sender_address.clone(),
        receiving_chain_id: receiving_chain_id.clone(),
        receiving_address: receiving_address.clone(),
        btc_amount,
        fee_amount: 0,
        minted_txn_hash: minted_txn_hash.clone(),
        timestamp,
        status: DEP_BTC_DEPOSITED_INTO_ATLAS,
        remarks: remarks.clone(),
        date_created,
        verified_count: 0,
        retry_count: 0,
        minted_txn_hash_verified_count: 0,
        custody_txn_id: "".to_string(),
    };

    let verified = atlas.increment_deposit_verified_count(mempool_deposit);
    assert!(verified, "Expected deposit verification to succeed");

    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.verified_count, 1, "Expected verified count to be 1");
    assert_eq!(
        deposit.status, DEP_BTC_DEPOSITED_INTO_ATLAS,
        "Expected status to be DEP_BTC_DEPOSITED_INTO_ATLAS"
    );
}

#[tokio::test]
async fn test_deposit_verification_with_invalid_data() {
    let (mut atlas, _) = setup_atlas();

    atlas.add_validator(accounts(1), "SIGNET".to_string());

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());

    let btc_txn_hash = "btc_txn_hash".to_string();
    let btc_sender_address = "btc_sender_address".to_string();
    let receiving_chain_id = "SIGNET".to_string();
    let receiving_address = "receiving_address".to_string();
    let btc_amount = 1000;
    let fee_amount = 0;
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
        fee_amount,
        minted_txn_hash.clone(),
        timestamp,
        remarks.clone(),
        date_created,
    );

    atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), timestamp);

    let invalid_mempool_deposit = DepositRecord {
        btc_txn_hash: btc_txn_hash.clone(),
        btc_sender_address: "invalid_sender".to_string(),
        receiving_chain_id: receiving_chain_id.clone(),
        receiving_address: receiving_address.clone(),
        btc_amount,
        fee_amount: 0,
        minted_txn_hash: minted_txn_hash.clone(),
        timestamp,
        status: DEP_BTC_DEPOSITED_INTO_ATLAS,
        remarks: remarks.clone(),
        date_created,
        verified_count: 0,
        retry_count: 0,
        minted_txn_hash_verified_count: 0,
        custody_txn_id: "".to_string(),
    };

    let verified = atlas.increment_deposit_verified_count(invalid_mempool_deposit);
    assert!(
        !verified,
        "Expected deposit verification to fail with invalid data"
    );
}

#[tokio::test]
async fn test_unauthorized_insert_deposit() {
    let (mut atlas, _) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(2))
        .build());

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.insert_deposit_btc(
            "btc_txn_hash".to_string(),
            "btc_sender_address".to_string(),
            "receiving_chain_id".to_string(),
            "receiving_address".to_string(),
            1000,
            0,
            "".to_string(),
            1234567890,
            "".to_string(),
            1234567890,
        );
    }));

    assert!(result.is_err(), "Expected panic due to unauthorized access");
}

#[tokio::test]
async fn test_unauthorized_deposit_update() {
    let (mut atlas, _) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());

    let btc_txn_hash = "btc_txn_hash".to_string();

    atlas.insert_deposit_btc(
        btc_txn_hash.clone(),
        "btc_sender_address".to_string(),
        "receiving_chain_id".to_string(),
        "receiving_address".to_string(),
        1000,
        0,
        "".to_string(),
        1234567890,
        "".to_string(),
        1234567890,
    );

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(2))
        .build());

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), 1234567891);
    }));

    assert!(result.is_err(), "Expected panic due to unauthorized access");
}

#[tokio::test]
async fn test_deposit_verification_with_multiple_validators() {
    let (mut atlas, _) = setup_atlas();

    atlas.add_validator(accounts(1), "SIGNET".to_string());
    atlas.add_validator(accounts(2), "SIGNET".to_string());

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());

    let btc_txn_hash = "btc_txn_hash".to_string();
    let btc_sender_address = "btc_sender_address".to_string();
    let receiving_chain_id = "SIGNET".to_string();
    let receiving_address = "receiving_address".to_string();
    let btc_amount = 1000;
    let fee_amount = 0;
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
        fee_amount,
        minted_txn_hash.clone(),
        timestamp,
        remarks.clone(),
        date_created,
    );

    atlas.update_deposit_btc_deposited(btc_txn_hash.clone(), timestamp);

    let mempool_deposit = DepositRecord {
        btc_txn_hash: btc_txn_hash.clone(),
        btc_sender_address: btc_sender_address.clone(),
        receiving_chain_id: receiving_chain_id.clone(),
        receiving_address: receiving_address.clone(),
        btc_amount,
        fee_amount: 0,
        minted_txn_hash: minted_txn_hash.clone(),
        timestamp,
        status: DEP_BTC_DEPOSITED_INTO_ATLAS,
        remarks: remarks.clone(),
        date_created,
        verified_count: 0,
        retry_count: 0,
        minted_txn_hash_verified_count: 0,
        custody_txn_id: "".to_string(),
    };

    let verified = atlas.increment_deposit_verified_count(mempool_deposit.clone());
    assert!(verified, "Expected deposit verification to succeed");

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(2))
        .build());

    let verified_again = atlas.increment_deposit_verified_count(mempool_deposit);
    assert!(
        verified_again,
        "Expected deposit verification to succeed with second validator"
    );

    let deposit = atlas
        .get_deposit_by_btc_txn_hash(btc_txn_hash.clone())
        .unwrap();
    assert_eq!(deposit.verified_count, 2, "Expected verified count to be 2");
}

#[tokio::test]
async fn test_add_validator() {
    let (mut atlas, owner_account) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(owner_account)
        .build());
    atlas.add_validator(accounts(4), "SIGNET".to_string());

    assert!(atlas.is_validator(&accounts(4), &"SIGNET".to_string()));
}

#[tokio::test]
async fn test_remove_validator() {
    let (mut atlas, owner_account) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(owner_account)
        .build());
    atlas.add_validator(accounts(4), "SIGNET".to_string());
    assert!(atlas.is_validator(&accounts(4), &"SIGNET".to_string()));

    atlas.remove_validator(accounts(4), "SIGNET".to_string());
    assert!(!atlas.is_validator(&accounts(4), &"SIGNET".to_string()));
}

#[tokio::test]
async fn test_get_chain_ids_by_validator_and_network_type() {
    let (mut atlas, owner_account) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(owner_account)
        .build());
    atlas.add_validator(accounts(4), "SIGNET".to_string());
    atlas.add_validator(accounts(4), "TESTNET".to_string());

    let chain_ids =
        atlas.get_chain_ids_by_validator_and_network_type(accounts(4), "SIGNET".to_string());
    assert_eq!(chain_ids, vec!["SIGNET".to_string()]);
}

#[tokio::test]
async fn test_is_validator() {
    let (mut atlas, owner_account) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(owner_account)
        .build());
    atlas.add_validator(accounts(4), "SIGNET".to_string());

    assert!(atlas.is_validator(&accounts(4), &"SIGNET".to_string()));
    assert!(!atlas.is_validator(&accounts(4), &"TESTNET".to_string()));
    assert!(!atlas.is_validator(&accounts(5), &"SIGNET".to_string()));
}

#[tokio::test]
async fn test_get_validators_by_txn_hash() {
    let (mut atlas, owner_account) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(owner_account)
        .build());
    atlas.add_validator(accounts(4), "SIGNET".to_string());
    atlas.add_validator(accounts(5), "SIGNET".to_string());

    // Note: We can't test add_verification as it's not implemented in the Atlas struct

    let validators = atlas.get_validators_by_txn_hash("txn_hash".to_string());
    assert!(validators.is_empty());
}

#[tokio::test]
async fn test_get_all_validators() {
    let (mut atlas, owner_account) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(owner_account)
        .build());
    atlas.add_validator(accounts(4), "SIGNET".to_string());
    atlas.add_validator(accounts(4), "TESTNET".to_string());
    atlas.add_validator(accounts(5), "SIGNET".to_string());

    let all_validators = atlas.get_all_validators();
    assert_eq!(all_validators.len(), 2);
    assert!(all_validators
        .iter()
        .any(|(account, chains)| *account == accounts(4)
            && chains.contains(&"SIGNET".to_string())
            && chains.contains(&"TESTNET".to_string())));
    assert!(all_validators
        .iter()
        .any(|(account, chains)| *account == accounts(5) && chains == &vec!["SIGNET".to_string()]));
}

#[tokio::test]
async fn test_get_all_verifications() {
    let (atlas, _) = setup_atlas();

    let all_verifications = atlas.get_all_verifications();
    assert!(all_verifications.is_empty());
}

#[tokio::test]
#[should_panic(expected = "Only the owner can call this method")]
async fn test_unauthorized_add_validator() {
    let (mut atlas, _) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.add_validator(accounts(4), "SIGNET".to_string());
}

#[tokio::test]
#[should_panic(expected = "Only the owner can call this method")]
async fn test_unauthorized_remove_validator() {
    let (mut atlas, owner_account) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(owner_account)
        .build());
    atlas.add_validator(accounts(4), "SIGNET".to_string());

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(1))
        .build());
    atlas.remove_validator(accounts(4), "SIGNET".to_string());
}

#[tokio::test]
async fn test_add_multiple_chain_ids_to_validator() {
    let (mut atlas, owner_account) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(owner_account)
        .build());
    atlas.add_validator(accounts(4), "SIGNET".to_string());
    atlas.add_validator(accounts(4), "TESTNET".to_string());
    atlas.add_validator(accounts(4), "MAINNET".to_string());

    assert!(atlas.is_validator(&accounts(4), &"SIGNET".to_string()));
    assert!(atlas.is_validator(&accounts(4), &"TESTNET".to_string()));
    assert!(atlas.is_validator(&accounts(4), &"MAINNET".to_string()));
}

#[tokio::test]
async fn test_remove_nonexistent_validator() {
    let (mut atlas, owner_account) = setup_atlas();

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(owner_account)
        .build());
    atlas.remove_validator(accounts(4), "SIGNET".to_string());

    assert!(!atlas.is_validator(&accounts(4), &"SIGNET".to_string()));
}
