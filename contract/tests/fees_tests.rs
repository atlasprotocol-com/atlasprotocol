use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use atlas_protocol::modules::structs::Atlas;

#[tokio::test]
async fn test_deposit_fee_calculation() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(2)); // Set to global_params owner
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2), // global_params_owner_id
        accounts(3),
        "treasury_address".to_string(),
        false,
    );

    atlas.update_fee_deposit_bps(100); // Set deposit fee to 1%
    let amount = 10000;
    let expected_fee = 100; // 1% of 10000

    let global_params = atlas.get_all_global_params();
    let global_params_json = serde_json::to_value(&global_params).unwrap();
    let fee_deposit_bps = global_params_json["fee_deposit_bps"].as_u64().unwrap() as u16;     
    let fee = (amount * fee_deposit_bps as u64 / 10000) as u64;

    assert_eq!(fee, expected_fee, "Deposit fee calculation is incorrect");
}

#[tokio::test]
async fn test_redemption_fee_calculation() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(2)); // Set to global_params owner
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2), // global_params_owner_id
        accounts(3),
        "treasury_address".to_string(),
        false,
    );

    atlas.update_fee_redemption_bps(200); // Set redemption fee to 2%
    let amount = 5000;
    let expected_fee = 100; // 2% of 5000

    let global_params = atlas.get_all_global_params();
    let global_params_json = serde_json::to_value(&global_params).unwrap();
    let fee_redemption_bps = global_params_json["fee_redemption_bps"].as_u64().unwrap() as u16;
    let fee = (amount * fee_redemption_bps as u64 / 10000) as u64;

    assert_eq!(fee, expected_fee, "Redemption fee calculation is incorrect");
}

#[tokio::test]
async fn test_bridging_fee_calculation() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(2)); // Set to global_params owner
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2), // global_params_owner_id
        accounts(3),
        "treasury_address".to_string(),
        false,
    );

    atlas.update_fee_bridging_bps(50); // Set bridging fee to 0.5%
    let amount = 20000;
    let expected_fee = 100; // 0.5% of 20000

    let global_params = atlas.get_all_global_params();
    let global_params_json = serde_json::to_value(&global_params).unwrap();
    let fee_bridging_bps = global_params_json["fee_bridging_bps"].as_u64().unwrap() as u16;
    let fee = (amount * fee_bridging_bps as u64 / 10000) as u64;

    assert_eq!(fee, expected_fee, "Bridging fee calculation is incorrect");
}

#[tokio::test]
async fn test_fee_calculation_with_zero_amount() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(2)); // Set to global_params owner
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2), // global_params_owner_id
        accounts(3),
        "treasury_address".to_string(),
        false,
    );

    atlas.update_fee_deposit_bps(0); // Set deposit fee to 0%
    let amount = 0 as u64;

    let global_params = atlas.get_all_global_params();
    let global_params_json = serde_json::to_value(&global_params).unwrap();
    let fee_deposit_bps = global_params_json["fee_deposit_bps"].as_u64().unwrap() as u16;
    let fee = (amount * fee_deposit_bps as u64 / 10000) as u64;

    assert_eq!(fee, amount, "Fee calculation with zero amount is incorrect");
}
