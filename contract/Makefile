CONTRACT_ID ?= atlas_testnet4_20250517
FT_CONTRACT_ID ?= atbtc_testnet4_20250517


migrate: 
	./build.sh
	near deploy $(CONTRACT_ID).velar.testnet res/atlas_protocol.wasm;
	near call $(CONTRACT_ID).velar.testnet migrate_prepare {} --accountId velar.testnet
	near call $(CONTRACT_ID).velar.testnet migrate_init {} --accountId velar.testnet

redeploy-all: redeploy redeploy-near-ft

redeploy:
	./build.sh

	near call $(CONTRACT_ID).velar.testnet clear_all_validators --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet clear_all_verifications --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet clear_all_chain_configs --accountId velar.testnet;
	
	near delete-account $(CONTRACT_ID).velar.testnet velar.testnet;
	near create-account $(CONTRACT_ID).velar.testnet --masterAccount velar.testnet --initialBalance 20;

	sleep 10;
	near state $(CONTRACT_ID).velar.testnet;

	near deploy $(CONTRACT_ID).velar.testnet res/atlas_protocol.wasm;
	near call $(CONTRACT_ID).velar.testnet new '{"atlas_owner_id": "velar.testnet", "atlas_admin_id": "velar_admin.testnet", "global_params_owner_id": "velar.testnet", "chain_configs_owner_id": "velar.testnet", "treasury_address": "tb1pa4xwtgs3672h38rqdveyk5w9jqczfhjxh89j8erdlr59yj92qs8szyvw53", "production_mode": false}' --accountId velar.testnet;

	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "421614"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "11155420"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "TESTNET4"}' --accountId velar.testnet;

	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "421614"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "11155420"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "TESTNET4"}' --accountId velar.testnet;

	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "buglungtung.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "buglungtung.testnet", "chain_id": "421614"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "buglungtung.testnet", "chain_id": "11155420"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "buglungtung.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet;
	near call $(CONTRACT_ID).velar.testnet add_validator '{"account_id": "buglungtung.testnet", "chain_id": "TESTNET4"}' --accountId velar.testnet;


redeploy-near-ft:
	cd tokens && ./build.sh
	cd tokens && near delete-account $(FT_CONTRACT_ID).velar.testnet velar.testnet;
	cd tokens && near create-account $(FT_CONTRACT_ID).velar.testnet --masterAccount velar.testnet --initialBalance 10;

	sleep 10;
	near state $(FT_CONTRACT_ID).velar.testnet;

	cd tokens && near deploy $(FT_CONTRACT_ID).velar.testnet res/atbtc.wasm;
	cd tokens && near call $(FT_CONTRACT_ID).velar.testnet new '{"owner_id":"$(CONTRACT_ID).velar.testnet","metadata":{"spec":"ft-1.0.0","name":"Atlas BTC","symbol":"atBTC","icon":"data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27100%27%20height=%27100%27%20viewBox=%270%200%20100%20100%27%3E%3Crect%20width=%27100%25%27%20height=%27100%25%27%20fill=%27%23e67e22%27/%3E%3Ctext%20x=%2750%25%27%20y=%2750%25%27%20font-family=%27Tahoma%27%20font-size=%2720%27%20font-weight=%27bold%27%20fill=%27white%27%20text-anchor=%27middle%27%20dominant-baseline=%27middle%27%3EatBTC%3C/text%3E%3C/svg%3E","reference":null,"reference_hash":null,"decimals":8}}' --accountId velar.testnet;

	sleep 10;
	near view $(FT_CONTRACT_ID).velar.testnet ft_metadata
	
	# near tokens buglungtung.testnet view-ft-balance atbtc_audit_v20241223.velar.testnet network-config testnet now
	