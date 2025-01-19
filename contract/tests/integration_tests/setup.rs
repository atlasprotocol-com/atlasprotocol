use atlas_protocol::Atlas;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use serde_json::json;

pub fn setup_atlas() -> Atlas {
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

    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(3))
        .build());
    atlas.set_chain_configs_from_json(chain_config_json);

    // Add validators
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(accounts(0))
        .build());
    atlas.add_validator(accounts(1), "SIGNET".to_string());
    atlas.add_validator(accounts(2), "SIGNET".to_string());
    atlas.add_validator(accounts(1), "421614".to_string());
    atlas.add_validator(accounts(2), "421614".to_string());
    atlas.add_validator(accounts(1), "NEAR_TESTNET".to_string());
    atlas.add_validator(accounts(2), "NEAR_TESTNET".to_string());

    atlas
}
