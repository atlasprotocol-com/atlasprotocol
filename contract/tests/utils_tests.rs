use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use atlas_protocol::modules::structs::Atlas;
use near_sdk::{env, AccountId};

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_atlas() -> (Atlas, AccountId) {
        let mut context = VMContextBuilder::new();
        let global_params_owner = accounts(2);
        context.predecessor_account_id(global_params_owner.clone());
        testing_env!(context.build());

        let atlas = Atlas::new(
            accounts(0),
            accounts(1),
            global_params_owner.clone(),
            accounts(3),
            "treasury_address".to_string(),
        );

        (atlas, global_params_owner)
    }

    #[tokio::test]
    async fn test_update_fee_deposit_bps_owner() {
        let (mut atlas, owner_account) = setup_atlas();
        let new_fee = 200; // 2%

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_fee_deposit_bps(new_fee);

        assert_eq!(atlas.global_params.get_fee_deposit_bps(), new_fee);
    }

    #[tokio::test]
    #[should_panic(expected = "Only the owner can call this method")]
    async fn test_update_fee_deposit_bps_non_owner() {
        let (mut atlas, _) = setup_atlas();
        let new_fee = 200; // 2%

        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
        atlas.update_fee_deposit_bps(new_fee);
    }

    #[tokio::test]
    async fn test_update_fee_redemption_bps_owner() {
        let (mut atlas, owner_account) = setup_atlas();
        let new_fee = 300; // 3%

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_fee_redemption_bps(new_fee);

        assert_eq!(atlas.global_params.get_fee_redemption_bps(), new_fee);
    }

    #[tokio::test]
    async fn test_get_chain_config_by_chain_id() {
        let (atlas, _) = setup_atlas();

        // Test for an existing chain ID
        let chain_config = atlas.get_chain_config_by_chain_id("SIGNET".to_string());
        assert!(chain_config.is_some(), "Expected to find SIGNET chain config");
        let signet_config = chain_config.unwrap();
        assert_eq!(signet_config.chain_id, "SIGNET");
        assert_eq!(signet_config.network_type, "SIGNET");

        // Test for a non-existent chain ID
        let non_existent_config = atlas.get_chain_config_by_chain_id("NON_EXISTENT".to_string());
        assert!(non_existent_config.is_none(), "Expected None for non-existent chain ID");
    }

    #[tokio::test]
    async fn test_get_all_constants() {
        let (atlas, _) = setup_atlas();

        let constants = atlas.get_all_constants();
        
        // Check if all expected keys are present
        assert!(constants.get("deposit_status").is_some(), "Expected deposit_status in constants");
        assert!(constants.get("redemption_status").is_some(), "Expected redemption_status in constants");
        assert!(constants.get("bridging_status").is_some(), "Expected bridging_status in constants");
        assert!(constants.get("network_type").is_some(), "Expected network_type in constants");
        assert!(constants.get("delimiter").is_some(), "Expected delimiter in constants");

        // Check some specific values
        let deposit_status = constants.get("deposit_status").unwrap();
        assert_eq!(deposit_status.get("DEP_BTC_PENDING_MEMPOOL").unwrap(), 0);

        let delimiter = constants.get("delimiter").unwrap();
        assert_eq!(delimiter.get("COMMA").unwrap(), ",");
    }

    #[tokio::test]
    async fn test_update_fee_bridging_bps_owner() {
        let (mut atlas, owner_account) = setup_atlas();
        let new_fee = 150; // 1.5%

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_fee_bridging_bps(new_fee);

        assert_eq!(atlas.global_params.get_fee_bridging_bps(), new_fee);
    }

    #[tokio::test]
    #[should_panic(expected = "Only the owner can call this method")]
    async fn test_update_fee_bridging_bps_non_owner() {
        let (mut atlas, _) = setup_atlas();
        let new_fee = 150; // 1.5%

        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
        atlas.update_fee_bridging_bps(new_fee);
    }

    #[tokio::test]
    async fn test_update_fee_babylon_rewards_bps_owner() {
        let (mut atlas, owner_account) = setup_atlas();
        let new_fee = 50; // 0.5%

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_fee_babylon_rewards_bps(new_fee);

        assert_eq!(atlas.global_params.get_fee_babylon_rewards_bps(), new_fee);
    }

    #[tokio::test]
    #[should_panic(expected = "Only the owner can call this method")]
    async fn test_update_fee_babylon_rewards_bps_non_owner() {
        let (mut atlas, _) = setup_atlas();
        let new_fee = 50; // 0.5%

        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
        atlas.update_fee_babylon_rewards_bps(new_fee);
    }

    #[tokio::test]
    async fn test_update_btc_staking_cap_owner() {
        let (mut atlas, owner_account) = setup_atlas();
        let new_cap = 1000000; // 10 BTC

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_btc_staking_cap(new_cap);

        assert_eq!(atlas.global_params.get_btc_staking_cap(), new_cap);
    }

    #[tokio::test]
    #[should_panic(expected = "Only the owner can call this method")]
    async fn test_update_btc_staking_cap_non_owner() {
        let (mut atlas, _) = setup_atlas();
        let new_cap = 1000000; // 10 BTC

        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
        atlas.update_btc_staking_cap(new_cap);
    }

    #[tokio::test]
    async fn test_update_btc_max_staking_amount_owner() {
        let (mut atlas, owner_account) = setup_atlas();
        let new_max = 500000; // 5 BTC

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_btc_max_staking_amount(new_max);

        assert_eq!(atlas.global_params.get_btc_max_staking_amount(), new_max);
    }

    #[tokio::test]
    #[should_panic(expected = "Only the owner can call this method")]
    async fn test_update_btc_max_staking_amount_non_owner() {
        let (mut atlas, _) = setup_atlas();
        let new_max = 500000; // 5 BTC

        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
        atlas.update_btc_max_staking_amount(new_max);
    }

    #[tokio::test]
    async fn test_update_btc_min_staking_amount_owner() {
        let (mut atlas, owner_account) = setup_atlas();
        let new_min = 10000; // 0.1 BTC

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_btc_min_staking_amount(new_min);

        assert_eq!(atlas.global_params.get_btc_min_staking_amount(), new_min);
    }

    #[tokio::test]
    #[should_panic(expected = "Only the owner can call this method")]
    async fn test_update_btc_min_staking_amount_non_owner() {
        let (mut atlas, _) = setup_atlas();
        let new_min = 10000; // 0.1 BTC

        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
        atlas.update_btc_min_staking_amount(new_min);
    }

    #[tokio::test]
    async fn test_update_treasury_address_owner() {
        let (mut atlas, owner_account) = setup_atlas();
        let new_address = "new_treasury_address".to_string();

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_treasury_address(new_address.clone());

        assert_eq!(atlas.global_params.get_treasury_address(), new_address);
    }

    #[tokio::test]
    #[should_panic(expected = "Only the owner can call this method")]
    async fn test_update_treasury_address_non_owner() {
        let (mut atlas, _) = setup_atlas();
        let new_address = "new_treasury_address".to_string();

        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
        atlas.update_treasury_address(new_address);
    }

    // ... (keep existing tests)

    #[tokio::test]
    async fn test_get_all_chain_configs() {
        let (atlas, _) = setup_atlas();
        let chain_configs = atlas.get_all_chain_configs();
        assert!(!chain_configs.is_empty(), "Expected at least one chain config");
        // Add more specific assertions based on your expected chain configs
    }

    #[tokio::test]
    async fn test_get_chain_config() {
        let (atlas, _) = setup_atlas();
        let signet_config = atlas.get_chain_config("SIGNET".to_string());
        assert!(signet_config.is_some(), "Expected SIGNET config to exist");
        let config = signet_config.unwrap();
        assert_eq!(config.chain_id, "SIGNET");
        assert_eq!(config.network_type, "SIGNET");
        // Add more assertions for other fields in the ChainConfigRecord
    }

    #[tokio::test]
    async fn test_set_chain_configs_from_json() {
        let (mut atlas, _) = setup_atlas();
        let new_json_data = r#"
        {
            "chains": [
                {
                    "chain_id": "TEST_CHAIN",
                    "network_type": "TESTNET",
                    "network_name": "Test Network",
                    "chain_rpc_url": "https://test.rpc.url",
                    "explorer_url": "https://test.explorer.url",
                    "abtc_address": "0x1234567890123456789012345678901234567890",
                    "native_currency_name": "Test Coin",
                    "native_currency_decimals": 18,
                    "native_currency_symbol": "TST",
                    "first_block": 1,
                    "batch_size": 100,
                    "gas_limit": 1000000,
                    "abi_path": "/path/to/abi.json",
                    "validators_threshold": 2
                }
            ]
        }
        "#.to_string();

        // Set the predecessor account to the chain_configs owner (account 3)
        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(3)).build());
        atlas.set_chain_configs_from_json(new_json_data);

        // Log all chain configs after setting
        let all_configs = atlas.get_all_chain_configs();
        env::log_str(&format!("All chain configs after setting: {:?}", all_configs));

        let test_config = atlas.get_chain_config_by_chain_id("TEST_CHAIN".to_string());
        assert!(test_config.is_some(), "Expected TEST_CHAIN config to exist");
        
        if let Some(config) = test_config {
            assert_eq!(config.chain_id, "TEST_CHAIN", "Chain ID mismatch");
            assert_eq!(config.network_type, "TESTNET", "Network type mismatch");
            assert_eq!(config.network_name, "Test Network", "Network name mismatch");
            assert_eq!(config.chain_rpc_url, "https://test.rpc.url", "RPC URL mismatch");
            assert_eq!(config.explorer_url, "https://test.explorer.url", "Explorer URL mismatch");
            assert_eq!(config.abtc_address, "0x1234567890123456789012345678901234567890", "ABTC address mismatch");
            assert_eq!(config.native_currency_name, "Test Coin", "Native currency name mismatch");
            assert_eq!(config.native_currency_decimals, 18, "Native currency decimals mismatch");
            assert_eq!(config.native_currency_symbol, "TST", "Native currency symbol mismatch");
            assert_eq!(config.first_block, 1, "First block mismatch");
            assert_eq!(config.batch_size, 100, "Batch size mismatch");
            assert_eq!(config.gas_limit, 1000000, "Gas limit mismatch");
            assert_eq!(config.abi_path, "/path/to/abi.json", "ABI path mismatch");
            assert_eq!(config.validators_threshold, 2, "Validators threshold mismatch");
        } else {
            panic!("TEST_CHAIN config not found");
        }
    }

    #[tokio::test]
    async fn test_set_mpc_contract() {
        let (mut atlas, owner_account) = setup_atlas();
        let new_mpc_contract = AccountId::new_unvalidated("new_mpc.testnet".to_string());

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.set_mpc_contract(new_mpc_contract.clone());

        assert_eq!(atlas.global_params.get_mpc_contract(), new_mpc_contract);
    }

    #[tokio::test]
    #[should_panic(expected = "Only the owner can call this method")]
    async fn test_set_mpc_contract_unauthorized() {
        let (mut atlas, _) = setup_atlas();
        let new_mpc_contract = AccountId::new_unvalidated("new_mpc.testnet".to_string());

        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
        atlas.set_mpc_contract(new_mpc_contract);
    }

    #[tokio::test]
    async fn test_get_all_global_params() {
        let (mut atlas, owner_account) = setup_atlas();
        
        // Set some non-zero values for the global parameters
        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_fee_deposit_bps(100);
        atlas.update_fee_redemption_bps(200);
        atlas.update_fee_bridging_bps(150);
        atlas.update_fee_babylon_rewards_bps(50);
        atlas.update_btc_staking_cap(1000000);
        atlas.update_btc_max_staking_amount(100000);
        atlas.update_btc_min_staking_amount(1000);

        assert!(atlas.global_params.get_mpc_contract().to_string().len() > 0);
        assert!(atlas.global_params.get_fee_deposit_bps() > 0);
        assert!(atlas.global_params.get_fee_redemption_bps() > 0);
        assert!(atlas.global_params.get_fee_bridging_bps() > 0);
        assert!(atlas.global_params.get_fee_babylon_rewards_bps() > 0);
        assert!(atlas.global_params.get_btc_staking_cap() > 0);
        assert!(atlas.global_params.get_btc_max_staking_amount() > 0);
        assert!(atlas.global_params.get_btc_min_staking_amount() > 0);
        assert!(atlas.global_params.get_treasury_address().len() > 0);
        assert!(atlas.global_params.owner_id().to_string().len() > 0);
    }

    // Add more tests for other utility functions as needed

    // New negative test cases

    #[tokio::test]
    #[should_panic(expected = "Invalid fee: must be between 0 and 10000 basis points")]
    async fn test_update_fee_deposit_bps_invalid() {
        let (mut atlas, owner_account) = setup_atlas();
        let invalid_fee = 10001; // 100.01%, which is invalid

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_fee_deposit_bps(invalid_fee);
    }

    #[tokio::test]
    #[should_panic(expected = "Invalid fee: must be between 0 and 10000 basis points")]
    async fn test_update_fee_redemption_bps_invalid() {
        let (mut atlas, owner_account) = setup_atlas();
        let invalid_fee = 10001; // 100.01%, which is invalid

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_fee_redemption_bps(invalid_fee);
    }

    #[tokio::test]
    #[should_panic(expected = "Invalid fee: must be between 0 and 10000 basis points")]
    async fn test_update_fee_bridging_bps_invalid() {
        let (mut atlas, owner_account) = setup_atlas();
        let invalid_fee = 10001; // 100.01%, which is invalid

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_fee_bridging_bps(invalid_fee);
    }

    #[tokio::test]
    #[should_panic(expected = "Invalid fee: must be between 0 and 10000 basis points")]
    async fn test_update_fee_babylon_rewards_bps_invalid() {
        let (mut atlas, owner_account) = setup_atlas();
        let invalid_fee = 10001; // 100.01%, which is invalid

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_fee_babylon_rewards_bps(invalid_fee);
    }

    #[tokio::test]
    #[should_panic(expected = "Invalid treasury address")]
    async fn test_update_treasury_address_invalid() {
        let (mut atlas, owner_account) = setup_atlas();
        let invalid_address = ""; // Empty string, which is invalid

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.update_treasury_address(invalid_address.to_string());
    }

    #[tokio::test]
    #[should_panic(expected = "Invalid MPC contract ID")]
    async fn test_set_mpc_contract_invalid() {
        let (mut atlas, owner_account) = setup_atlas();
        let invalid_mpc_contract = AccountId::new_unvalidated("".to_string()); // Empty string, which is invalid

        testing_env!(VMContextBuilder::new().predecessor_account_id(owner_account).build());
        atlas.set_mpc_contract(invalid_mpc_contract);
    }

    #[tokio::test]
    #[should_panic(expected = "Invalid JSON data for chain configs")]
    async fn test_set_chain_configs_from_json_invalid() {
        let (mut atlas, _) = setup_atlas();
        let invalid_json_data = "{ this is not valid JSON }".to_string(); // Invalid JSON

        // Set the predecessor account to the chain_configs owner (account 3)
        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(3)).build());
        atlas.set_chain_configs_from_json(invalid_json_data);
    }

    #[tokio::test]
    async fn test_is_valid_eth_address() {
        
        // Valid Ethereum address
        assert!(Atlas::is_valid_eth_address("0x742d35Cc6634C0532925a3b844Bc454e4438f44e".to_string()));
        
        // Invalid Ethereum addresses
        assert!(!Atlas::is_valid_eth_address("0x742d35Cc6634C0532925a3b844Bc454e4438f44".to_string())); // Too short
        assert!(!Atlas::is_valid_eth_address("0x742d35Cc6634C0532925a3b844Bc454e4438f44e1".to_string())); // Too long
        assert!(!Atlas::is_valid_eth_address("742d35Cc6634C0532925a3b844Bc454e4438f44e".to_string())); // Missing 0x prefix
        assert!(!Atlas::is_valid_eth_address("0xG42d35Cc6634C0532925a3b844Bc454e4438f44e".to_string())); // Invalid character
    
    // Add more negative test cases for other utility functions as needed
    }
}