use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use atlas_protocol::modules::structs::Atlas;
use near_sdk::AccountId;

#[tokio::test]
async fn test_initialization() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    testing_env!(context.build());

    let atlas = Atlas::new(
        accounts(0), // atlas_owner_id
        accounts(1), // atlas_admin_id
        accounts(2), // global_params_owner_id
        accounts(3), // chain_configs_owner_id
        "treasury_address".to_string(),
    );

    assert_eq!(atlas.get_atlas_owner_id(), accounts(0));
    assert_eq!(atlas.get_atlas_admin_id(), accounts(1));
}

#[tokio::test]
async fn test_change_owner() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    atlas.change_atlas_owner_id(accounts(4));
    assert_eq!(atlas.get_atlas_owner_id(), accounts(4));
}

#[tokio::test]
async fn test_change_admin() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    atlas.change_atlas_admin_id(accounts(5));
    assert_eq!(atlas.get_atlas_admin_id(), accounts(5));
}

#[tokio::test]
async fn test_unauthorized_change_owner() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1)); // Not the owner
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.change_atlas_owner_id(accounts(4));
    }));

    assert!(result.is_err(), "Expected panic due to unauthorized owner change");
}

#[tokio::test]
async fn test_unauthorized_change_admin() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1)); // Not the owner
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        atlas.change_atlas_admin_id(accounts(5));
    }));

    assert!(result.is_err(), "Expected panic due to unauthorized admin change");
}

#[tokio::test]
async fn test_assert_owner() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    testing_env!(context.build());

    let atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    atlas.assert_owner(); // Should not panic
}

#[tokio::test]
async fn test_assert_admin() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1));
    testing_env!(context.build());

    let atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    atlas.assert_admin(); // Should not panic
}

#[tokio::test]
#[should_panic(expected = "Atlas owner ID cannot be empty")]
async fn test_new_with_empty_owner_id() {
    let context = VMContextBuilder::new();
    testing_env!(context.build());

    Atlas::new(
        AccountId::new_unvalidated("".to_string()),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );
}

#[tokio::test]
#[should_panic(expected = "Atlas admin ID cannot be empty")]
async fn test_new_with_empty_admin_id() {
    let context = VMContextBuilder::new();
    testing_env!(context.build());

    Atlas::new(
        accounts(0),
        AccountId::new_unvalidated("".to_string()),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );
}

#[tokio::test]
#[should_panic(expected = "Global params owner ID cannot be empty")]
async fn test_new_with_empty_global_params_owner_id() {
    let context = VMContextBuilder::new();
    testing_env!(context.build());

    Atlas::new(
        accounts(0),
        accounts(1),
        AccountId::new_unvalidated("".to_string()),
        accounts(3),
        "treasury_address".to_string(),
    );
}

#[tokio::test]
#[should_panic(expected = "Chain configs owner ID cannot be empty")]
async fn test_new_with_empty_chain_configs_owner_id() {
    let context = VMContextBuilder::new();
    testing_env!(context.build());

    Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        AccountId::new_unvalidated("".to_string()),
        "treasury_address".to_string(),
    );
}

#[tokio::test]
#[should_panic(expected = "Treasury address cannot be empty")]
async fn test_new_with_empty_treasury_address() {
    let context = VMContextBuilder::new();
    testing_env!(context.build());

    Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "".to_string(),
    );
}

#[tokio::test]
#[should_panic(expected = "New owner ID cannot be blank")]
async fn test_change_owner_to_empty_id() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    atlas.change_atlas_owner_id(AccountId::new_unvalidated("".to_string()));
}

#[tokio::test]
#[should_panic(expected = "New owner ID must be different from the current owner ID")]
async fn test_change_owner_to_same_id() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    atlas.change_atlas_owner_id(accounts(0));
}

#[tokio::test]
#[should_panic(expected = "New admin ID cannot be blank")]
async fn test_change_admin_to_empty_id() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    atlas.change_atlas_admin_id(AccountId::new_unvalidated("".to_string()));
}

#[tokio::test]
#[should_panic(expected = "New admin ID must be different from the current admin ID")]
async fn test_change_admin_to_same_id() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0));
    testing_env!(context.build());

    let mut atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    atlas.change_atlas_admin_id(accounts(1));
}

#[tokio::test]
#[should_panic(expected = "Only the owner can call this method")]
async fn test_assert_owner_with_non_owner() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(1)); // Not the owner
    testing_env!(context.build());

    let atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    atlas.assert_owner();
}

#[tokio::test]
#[should_panic(expected = "Only the admin can call this method")]
async fn test_assert_admin_with_non_admin() {
    let mut context = VMContextBuilder::new();
    context.predecessor_account_id(accounts(0)); // Not the admin
    testing_env!(context.build());

    let atlas = Atlas::new(
        accounts(0),
        accounts(1),
        accounts(2),
        accounts(3),
        "treasury_address".to_string(),
    );

    atlas.assert_admin();
}