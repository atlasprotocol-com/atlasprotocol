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
    let fee = atlas.get_deposit_tax_amount(amount);
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
    let fee = atlas.get_redemption_tax_amount(amount);
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
    let fee = atlas.get_bridging_tax_amount(amount);
    assert_eq!(fee, expected_fee, "Bridging fee calculation is incorrect");
}

#[tokio::test]
async fn test_fee_calculation_with_zero_amount() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(2)); // Set to global_params owner
    testing_env!(context.build());

    let atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2), // global_params_owner_id
        accounts(3),
        "treasury_address".to_string(),
        false,
    );

    let amount = 0;
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.get_deposit_tax_amount(amount);
    }));
    assert!(result.is_err(), "Expected panic due to zero amount");
}

#[tokio::test]
async fn test_fee_calculation_with_large_amount() {
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
    let amount = u64::MAX;
    let expected_fee = (amount as u128 * 100 / 10000) as u64; // 1% of the maximum amount
    let fee = atlas.get_deposit_tax_amount(amount);
    assert_eq!(fee, expected_fee, "Deposit fee calculation is incorrect for large amount");
}