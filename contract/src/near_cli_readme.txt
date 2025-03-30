near login

SMART CONTRACTS

Compile NEAR contract (CLI)

dos2unix ./build.sh
./build.sh

To migrate to new version of smart contract
near call atlas_testnet4_v.velar.testnet update_contract --base64 $(base64 -w 0 target/wasm32-unknown-unknown/release/atlas_protocol.wasm) --accountId velar.testnet --gas 300000000000000

If want to delete NEAR smart contract
near call atlas_dev.velar.testnet clear_all_deposits --accountId velar.testnet
near call atlas_dev.velar.testnet clear_all_redemptions --accountId velar.testnet
near call atlas_dev.velar.testnet clear_all_bridgings --accountId velar.testnet
near call atlas_revamp.velar.testnet clear_all_validators --accountId velar.testnet
near call atlas_revamp.velar.testnet clear_all_verifications --accountId velar.testnet
near call atlas_revamp.velar.testnet clear_all_chain_configs --accountId velar.testnet

near delete-account atlas_dev_1.velar.testnet velar.testnet
near delete-account atlas_revamp.velar.testnet velar.testnet

Create NEAR Subaccount (CLI)
near create-account atlas_dev_1.velar.testnet --masterAccount velar.testnet --initialBalance 10
near create-account atlas_revamp.velar.testnet --masterAccount velar.testnet --initialBalance 10

Check State of the NEAR Account - No need to run for delete of smart contract (CLI)
near state atlas_dev_1.velar.testnet

Deploy NEAR contract (CLI)
near deploy atlas_dev_1.velar.testnet res/atlas_protocol.wasm
near deploy atlas_revamp.velar.testnet res/atlas_protocol.wasm

Initialise NEAR contract (CLI)
near call atlas_dev_1.velar.testnet new '{"atlas_owner_id": "velar.testnet", "atlas_admin_id": "yeowlin.testnet", "global_params_owner_id": "velar.testnet", "chain_configs_owner_id": "velar.testnet", "treasury_address": "tb1pa4xwtgs3672h38rqdveyk5w9jqczfhjxh89j8erdlr59yj92qs8szyvw53", "production_mode": false}' --accountId velar.testnet
near call atlas_revamp.velar.testnet new '{"atlas_owner_id": "velar.testnet", "atlas_admin_id": "velar.testnet", "global_params_owner_id": "velar.testnet", "chain_configs_owner_id": "velar.testnet", "treasury_address": "tb1pa4xwtgs3672h38rqdveyk5w9jqczfhjxh89j8erdlr59yj92qs8szyvw53"}' --accountId velar.testnet

Call NEAR contract methods (CLI)
near view atlas_dev.velar.testnet get_all_deposits
near view atlas_dev.velar.testnet get_all_redemptions
near view atlas_dev.velar.testnet get_all_bridgings
near view atlas_revamp.velar.testnet get_all_global_params
near view atlas_revamp.velar.testnet get_all_chain_configs
near view atlas_revamp.velar.testnet get_all_constants
near view atlas_revamp.velar.testnet get_all_validators
near view atlas_revamp.velar.testnet get_all_verifications

near view atlas_dev.velar.testnet get_deposits_count
near view atlas_dev.velar.testnet get_redemptions_count
near view atlas_dev.velar.testnet get_bridgings_count

near view atlas_dev.velar.testnet get_deposits_by_btc_sender_address '{"btc_sender_address": "tb1pn3axvlfpuzna9skzzmqw26k97xj0gkettk4vz290phdd46a5d2rqj8xsj2"}'

near call atlas_dev.velar.testnet change_owner '{"new_owner_id": "velar.testnet"}' --accountId velar.testnet
near call atlas_dev_1.velar.testnet propose_new_atlas_owner '{"proposed_owner_id": "yeowlin2.testnet"}' --accountId velar.testnet
near call atlas_dev_1.velar.testnet accept_atlas_owner --accountId yeowlin2.testnet
near call atlas_dev_1.velar.testnet propose_new_atlas_admin '{"proposed_admin_id": "velar.testnet"}' --accountId yeowlin2.testnet
near call atlas_dev_1.velar.testnet accept_atlas_admin --accountId velar.testnet
near view atlas_dev_1.velar.testnet get_atlas_owner_id
near view atlas_dev_1.velar.testnet get_atlas_admin_id
near view atlas_dev_1.velar.testnet get_chain_configs_owner_id
near call atlas_dev_1.velar.testnet propose_new_global_params_owner '{"proposed_owner_id": "yeowlin.testnet"}' --accountId velar.testnet
near call atlas_dev_1.velar.testnet accept_global_params_owner --accountId yeowlin.testnet
near call atlas_dev_1.velar.testnet propose_new_chain_configs_owner '{"proposed_owner_id": "yeowlin.testnet"}' --accountId velar.testnet
near call atlas_dev_1.velar.testnet accept_chain_configs_owner --accountId yeowlin.testnet
near call atlas_dev_1.velar.testnet pause --accountId velar.testnet
near call atlas_dev_1.velar.testnet unpause --accountId velar.testnet
near view atlas_dev_1.velar.testnet is_paused
near view atlas_dev_1.velar.testnet is_production_mode

near call atlas_dev.velar.testnet get_deposit_by_btc_txn_hash '{"btc_txn_hash": "698fdaf6b008cddfbfcad2eca12af40f70145d2d3f32950e4dc7b46e1875c007"}' --accountId velar.testnet

near call atlas_dev.velar.testnet update_deposit_remarks '{"btc_txn_hash": "ffe62ea0b206fe5bda452de481b9f666a0ff355e8d315df52c97444bcb6d0938", "remarks": ""}' --accountId velar.testnet
near call atlas_dev.velar.testnet update_deposit_status '{"btc_txn_hash": "ffe62ea0b206fe5bda452de481b9f666a0ff355e8d315df52c97444bcb6d0938", "status": 10}' --accountId velar.testnet
near call atlas_revamp.velar.testnet update_deposit_remarks '{"btc_txn_hash": "d1d41bc43a38af2c8d27022f75b450bbd8d41afa5a51e36e5bb2340a93863eaa", "remarks": "ERROR"}' --accountId velar.testnet
near call atlas_revamp.velar.testnet update_deposit_status '{"btc_txn_hash": "d1d41bc43a38af2c8d27022f75b450bbd8d41afa5a51e36e5bb2340a93863eaa", "status": 21}' --accountId velar.testnet

near call atlas_dev.velar.testnet update_redemption_remarks '{"txn_hash": "421614,0x511225addbf3d5c5d150f362f7fcf2120980c0e0c513c83cf76c0ea5a62d4d37", "remarks": ""}' --accountId velar.testnet
near call atlas_dev.velar.testnet update_redemption_status '{"txn_hash": "421614,0x511225addbf3d5c5d150f362f7fcf2120980c0e0c513c83cf76c0ea5a62d4d37", "status": 10}' --accountId velar.testnet
near call atlas_dev.velar.testnet update_redemption_status '{"txn_hash": "421614,0x81424fb9aa8c231a12cd0eea8a1ef82d95ce512e57c6256feed6d0f47d4d7755", "status": 22}' --accountId velar.testnet
near call atlas_dev.velar.testnet update_redemption_btc_txn_hash '{"txn_hash": "421614,0x81424fb9aa8c231a12cd0eea8a1ef82d95ce512e57c6256feed6d0f47d4d7755", "btc_txn_hash": "f41e5b6dfdda5c119837d55ae5e066ddaa3c2384723518e426990643ca8c1419"}' --accountId velar.testnet

near call atlas_dev.velar.testnet update_bridging_remarks '{"txn_hash": "421614,0x50a5587343550912f5043c69567f7616cac1753dc3604d04181168ed30e23de9", "remarks": ""}' --accountId velar.testnet
near call atlas_dev.velar.testnet update_bridging_status '{"txn_hash": "421614,0x50a5587343550912f5043c69567f7616cac1753dc3604d04181168ed30e23de9", "status": 10}' --accountId velar.testnet

near call atlas_dev.velar.testnet update_fee_redemption_bps '{"fee_redemption_bps": 0}' --accountId velar.testnet

near call atlas_dev.velar.testnet update_btc_min_staking_amount '{"btc_min_staking_amount": 2000}' --accountId velar.testnet

near view atlas.yeowlin.testnet get_all_redemptions
near call atlas.yeowlin.testnet update_redemption_remarks '{"txn_hash": "421614,0x4177551f85bd9437f5a1e35040762a229cfa73db0e8cf315e14ad7d109632358", "remarks": ""}' --accountId yeowlin.testnet
near call atlas.yeowlin.testnet update_redemption_status '{"txn_hash": "421614,0x4177551f85bd9437f5a1e35040762a229cfa73db0e8cf315e14ad7d109632358", "status": 10}' --accountId yeowlin.testnet

near call atlas_revamp.velar.testnet create_mint_abtc_signed_payload --accountId velar.testnet
near view atlas_revamp.velar.testnet get_chain_config_by_chain_id '{"chain_id": "Signet"}'
near view atlas_revamp.velar.testnet get_chain_config_by_chain_id '{"chain_id": "421614"}'

near call atlas_revamp.velar.testnet insert_deposit_btc '{"btc_txn_hash": "d1d41bc43a38af2c8d27022f75b450bbd8d41afa5a51e36e5bb2340a93863eaa", "btc_sender_address": "tb1qeswd8std5zs4nr2y9n63rmns3yf9qwp6etpyvh", "receiving_chain_id": "421614", "receiving_address": "0xAd77B6fB6B1245df29Ee6833f635439561f84c48", "btc_amount": 2000, "minted_txn_hash": "", "timestamp": 1725517823, "status": 10, "remarks": "", "date_created": 1725516889, "verified_count": 0}' --accountId velar.testnet
near call atlas_revamp.velar.testnet insert_deposit_btc '{"btc_txn_hash": "ee3585f181e9d432a106627896a5e54f1cb39ed6c45b1d269b6eda046ff1e904", "btc_sender_address": "tb1pn3axvlfpuzna9skzzmqw26k97xj0gkettk4vz290phdd46a5d2rqj8xsj2", "receiving_chain_id": "11155420", "receiving_address": "0xAd77B6fB6B1245df29Ee6833f635439561f84c48", "btc_amount": 4000, "minted_txn_hash": "", "timestamp": 1724744079, "status": 10, "remarks": "", "date_created": 1724743677, "verified_count": 0}' --accountId velar.testnet
near call atlas_revamp.velar.testnet insert_redemption_abtc '{"txn_hash": "421614,0x9c6a8a9afc62e0c5efe17f75ea95a0638a8fd6335aed33a936ade816f84ba19a", "abtc_redemption_address": "0x7E49738Cc16B011746f68a202141068530db8924", "abtc_redemption_chain_id": "421614", "btc_receiving_address": "tb1pxltv93d2fjmty7958v39k70vwlwg5u5pe47sq6kz8xnd5xhyh4tqmmtdgn", "abtc_amount": 30000, "btc_txn_hash": "", "timestamp": 1725518012, "status": 10, "remarks": "", "date_created": 1725518012, "verified_count": 0}' --accountId velar.testnet
near call atlas_revamp.velar.testnet insert_redemption_abtc '{"txn_hash": "11155420,0x2ec6e7090a786a232b01f4ecfdf563130d49a932dc2e3da1488287bae5a1bd1e", "abtc_redemption_address": "0xAd77B6fB6B1245df29Ee6833f635439561f84c48", "abtc_redemption_chain_id": "11155420", "btc_receiving_address": "tb1pn3axvlfpuzna9skzzmqw26k97xj0gkettk4vz290phdd46a5d2rqj8xsj2", "abtc_amount": 2000, "btc_txn_hash": "", "timestamp": 1724743274, "status": 10, "remarks": "", "date_created": 1724743274, "verified_count": 0}' --accountId velar.testnet
near call atlas_revamp.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "Signet"}' --accountId velar.testnet
near call atlas_revamp.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_revamp.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_revamp.velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "Signet"}' --accountId velar.testnet
near call atlas_revamp.velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_revamp.velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "11155420"}' --accountId velar.testnet

near call atlas_revamp.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "e1a9fb31772aa281f1a5d6afb15ee4ef6f2c6926716d49526112a41430c31ec5"}' --accountId velar.testnet
near call atlas_revamp.velar.testnet rollback_all_deposit_status --accountId velar.testnet

LAUNCH UI
npm start

To change contract names to own local names, search for "almostthere.testnet" in the project

To convert network.chain.config.ts to .js
tsc network.chain.config.ts


This section onward is for revamp. Using atlas_revamp_3
./build.sh
near call atlas_revamp_10.velar.testnet clear_all_deposits --accountId velar.testnet
near call atlas_revamp_10.velar.testnet clear_all_redemptions --accountId velar.testnet
near call atlas_revamp_10.velar.testnet clear_all_bridgings --accountId velar.testnet
near call atlas_revamp_10.velar.testnet clear_all_verifications --accountId velar.testnet
near call atlas_revamp_10.velar.testnet clear_all_chain_configs --accountId velar.testnet
near delete-account atlas_revamp_10.velar.testnet velar.testnet
near create-account atlas_revamp_10.velar.testnet --masterAccount velar.testnet --initialBalance 10
near deploy atlas_revamp_10.velar.testnet res/atlas_protocol.wasm
near call atlas_revamp_10.velar.testnet new '{"atlas_owner_id": "velar.testnet", "atlas_admin_id": "velar.testnet", "global_params_owner_id": "velar.testnet", "chain_configs_owner_id": "velar.testnet", "treasury_address": "tb1pa4xwtgs3672h38rqdveyk5w9jqczfhjxh89j8erdlr59yj92qs8szyvw53"}' --accountId velar.testnet

near call atlas_revamp_10.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_revamp_10.velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_revamp_10.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_revamp_10.velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_revamp_10.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_revamp_10.velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "11155420"}' --accountId velar.testnet

near view atlas_revamp_10.velar.testnet get_all_chain_configs
near view atlas_revamp_10.velar.testnet get_all_deposits
near view atlas_revamp_10.velar.testnet get_all_redemptions
near view atlas_revamp_10.velar.testnet get_first_valid_deposit_chain_config

near call atlas_revamp_10.velar.testnet update_deposit_remarks '{"btc_txn_hash": "8cc0afd07737877ed7c22cc7850759b95535516dfde4e260311f2253bc04ed33", "remarks": ""}' --accountId velar.testnet
near call atlas_revamp_10.velar.testnet update_deposit_status '{"btc_txn_hash": "8cc0afd07737877ed7c22cc7850759b95535516dfde4e260311f2253bc04ed33", "status": 10}' --accountId velar.testnet

0x8d82e81492ecd8b23737082f88ee10238ef87d0ea6a285323fcdac6468c7a994
near call atlas_revamp_10.velar.testnet update_redemption_remarks '{"txn_hash": "421614,0x5f57a32109380c7f4277eeedc029b92ef727c5b23b338a848d33b296e5652e16", "remarks": ""}' --accountId velar.testnet
near call atlas_revamp_10.velar.testnet update_redemption_status '{"txn_hash": "421614,0x5f57a32109380c7f4277eeedc029b92ef727c5b23b338a848d33b296e5652e16", "status": 10}' --accountId velar.testnet


near call atlas_revamp_10.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "9d8eebf47242770c87438c37570219afc497f4c6e2693b3f7c94c99448d47703"}' --accountId velar.testnet

near call atlas_revamp_3.velar.testnet update_deposit_remarks '{"btc_txn_hash": "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13", "remarks": ""}' --accountId velar.testnet
near call atlas_revamp_3.velar.testnet update_deposit_status '{"btc_txn_hash": "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13", "status": 10}' --accountId velar.testnet

near view atlas_revamp_3.velar.testnet get_first_valid_deposit_chain_config
near call atlas_revamp_3.velar.testnet create_mint_abtc_transaction '{"btc_txn_hash": "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13","nonce": 94, "gas": 5000000, "max_fee_per_gas": 100000000, "max_priority_fee_per_gas": 0}' --accountId velar.testnet --gas 300000000000000

near call atlas_revamp_3.velar.testnet get_deposit_by_btc_txn_hash '{"btc_txn_hash": "09b6692e4cd8fd347f7e534db586a75c3b903d90e7c4377803a713823646fb92"}' --accountId velar.testnet
near call atlas_revamp_3.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "781eaa989e5e35db6da84cb190e3df49c21cee8931e5301e91e8d9820e8f2c13"}' --accountId velar.testnet
near view atlas_revamp_3.velar.testnet get_all_constants

near call atlas_revamp_3.velar.testnet get_redemption_by_txn_hash '{"txn_hash": "421614,0x6b51b5a510baf0c9d9d67d40e89324891d4a24cbca04b4618651a87e323af75f"}' --accountId velar.testnet

near call atlas_revamp_3.velar.testnet get_deposit_by_btc_txn_hash '{"btc_txn_hash": "91d2582c35be838bd049e47a0da7ec20dafe532ee95a5e58be31a8eb93afa006"}' --accountId velar.testnet
near call atlas_revamp_3.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "09b6692e4cd8fd347f7e534db586a75c3b903d90e7c4377803a713823646fb92"}' --accountId velar.testnet
near call atlas_revamp_3.velar.testnet update_deposit_status '{"btc_txn_hash": "91d2582c35be838bd049e47a0da7ec20dafe532ee95a5e58be31a8eb93afa006", "status": 10}' --accountId velar.testnet
near call atlas_revamp_3.velar.testnet update_deposit_remarks '{"btc_txn_hash": "91d2582c35be838bd049e47a0da7ec20dafe532ee95a5e58be31a8eb93afa006", "remarks": ""}' --accountId velar.testnet

near call atlas_revamp_3.velar.testnet update_deposit_status '{"btc_txn_hash": "91d2582c35be838bd049e47a0da7ec20dafe532ee95a5e58be31a8eb93afa006", "status": 21}' --accountId velar.testnet
near call atlas_revamp_3.velar.testnet update_redemption_status '{"txn_hash": "421614,0x0ac5f6ab1386f71f890194198b98ce134ea2ec6afb3bd999e55d6e5b63dbaf70", "status": 10}' --accountId velar.testnet
near call atlas_revamp_3.velar.testnet update_redemption_remarks '{"txn_hash": "421614,0x0ac5f6ab1386f71f890194198b98ce134ea2ec6afb3bd999e55d6e5b63dbaf70", "remarks": ""}' --accountId velar.testnet

near call atlas_revamp_3.velar.testnet create_redeem_abtc_signed_payload '{
    "txn_hash": "421614,0x3c0d3f5a17dd08d897d58eddb4a0ad9127c063ccb964edcef8b486d3763b100a",
    "utxos": [
        {
            "txid": "0a3555e93bfe9a3d2538b97cb7329c8121568b65c43aac20c9e5c4227995113c",
            "vout": 0,
            "value": 2000,
            "script": null
        },
        {
            "txid": "af91b75bd35a39681af47addbabde12f3debeb6dae8e9c46391ec6d42c4b4ca7",
            "vout": 0,
            "value": 2000,
            "script": null
        }
    ],
    "fee_rate": 1
}' --accountId velar.testnet --gas 300000000000000


near call atlas_revamp_3.velar.testnet decode_payload '{"payload": [20,  86,   9,  65,  98, 100, 237,  83, 245,  91,  92, 219, 157, 181, 244, 156, 216, 255, 207, 178, 166,  15,  42, 152, 223, 192,  28, 215, 190, 105, 119, 37]}' --accountId velar.testnet

create_redeem_abtc_transaction

near call atlas_revamp_3.velar.testnet create_redeem_abtc_transaction '{
  "sender": "tb1qwn7x9qdjtftldxnl08dg8425zf04f94eltxwym",
  "txn_hash": "421614,0x3c0d3f5a17dd08d897d58eddb4a0ad9127c063ccb964edcef8b486d3763b100a",
  "utxos": [
    { "txid": "txid1", "vout": 0, "value": 50000, "script": "" },
    { "txid": "txid2", "vout": 1, "value": 60000, "script": "" }
  ],
  "fee_rate": 1
}' --accountId velar.testnet --gas 300000000000000

near call atlas_revamp_3.velar.testnet update_redemption_status '{"txn_hash": "421614,0x3c0d3f5a17dd08d897d58eddb4a0ad9127c063ccb964edcef8b486d3763b100a", "status": 10}' --accountId velar.testnet
near call atlas_revamp_3.velar.testnet update_redemption_remarks '{"txn_hash": "421614,0x3c0d3f5a17dd08d897d58eddb4a0ad9127c063ccb964edcef8b486d3763b100a", "remarks": ""}' --accountId velar.testnet

near view atlas_revamp_3.velar.testnet get_all_deposits
near view atlas_revamp_3.velar.testnet get_first_valid_redemption

near view atlas_revamp_3.velar.testnet get_first_valid_deposit
near call atlas_revamp_3.velar.testnet update_deposit_status '{"btc_txn_hash": "79bb7cdaf43314ac4c7d626e5eefb95a2db3f4f42bdfcab009d4be4544fe9661", "status": 10}' --accountId velar.testnet
near call atlas_revamp_3.velar.testnet update_deposit_remarks '{"btc_txn_hash": "79bb7cdaf43314ac4c7d626e5eefb95a2db3f4f42bdfcab009d4be4544fe9661", "remarks": ""}' --accountId velar.testnet

near call atlas_revamp_3.velar.testnet create_mint_abtc_signed_payload '{"btc_txn_hash": "9ae3b11e6c6e0ddbaffe6fb5443e52ed2a8b7cfade9d2ce3bd4765f824ac903a", "nonce": 1, "gas": 21000, "max_fee_per_gas": 1000000000, "max_priority_fee_per_gas": 1000000000}' --accountId velar.testnet --gas 300000000000000 

near call atlas_revamp_3.velar.testnet update_deposit_status '{"btc_txn_hash": "d15280e20acb30c69267795e107ec27f4fd6246342efe6443f714c7ee6169ea4", "status": 10}' --accountId velar.testnet

near call atlas_revamp_3.velar.testnet update_deposit_status '{"btc_txn_hash": "b71d3878f6a9ee5c821179a8f38cf8e422d2661b8c5d2ca28e42edda471ba234", "status": 10}' --accountId velar.testnet
near call atlas_revamp_3.velar.testnet update_deposit_remarks '{"btc_txn_hash": "b71d3878f6a9ee5c821179a8f38cf8e422d2661b8c5d2ca28e42edda471ba234", "remarks": ""}' --accountId velar.testnet


near call atlas_audit.velar.testnet clear_all_deposits --accountId velar.testnet
near call atlas_audit.velar.testnet clear_all_redemptions --accountId velar.testnet
near call atlas_audit.velar.testnet clear_all_bridgings --accountId velar.testnet
near call atlas_audit.velar.testnet clear_all_validators --accountId velar.testnet
near call atlas_audit.velar.testnet clear_all_verifications --accountId velar.testnet
near call atlas_audit.velar.testnet clear_all_chain_configs --accountId velar.testnet
near delete-account atlas_audit.velar.testnet velar.testnet
near create-account atlas_audit.velar.testnet --masterAccount velar.testnet --initialBalance 10
near deploy atlas_audit.velar.testnet res/atlas_protocol.wasm
near call atlas_audit.velar.testnet new '{"atlas_owner_id": "velar.testnet", "atlas_admin_id": "velar.testnet", "global_params_owner_id": "velar.testnet", "chain_configs_owner_id": "velar.testnet", "treasury_address": "tb1pa4xwtgs3672h38rqdveyk5w9jqczfhjxh89j8erdlr59yj92qs8szyvw53"}' --accountId velar.testnet

near call atlas_audit.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar1.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar2.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar3.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar4.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar5.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar1.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar2.rtestnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar3.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar4.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar5.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar1.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar2.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar3.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar4.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar5.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "yeowlin.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar1.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar2.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar3.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar4.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet
near call atlas_audit.velar.testnet add_validator '{"account_id": "velar5.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet
near view atlas_audit.velar.testnet get_all_deposits
near view atlas_audit.velar.testnet get_all_chain_configs
near call atlas_audit.velar.testnet set_chain_configs_from_json '{"new_json_data": '"$(jq -Rs '.' < chain_chains.json)"'}' --accountId velar.testnet
near call atlas_audit.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "aa580a38218aa5b59752882d523bc0cf661de25d4b9bdd9800f06cfc41635818"}' --accountId velar.testnet


near deploy atbtc_audit_2.velar.testnet res/atbtc.wasm
near call atbtc_audit_2.velar.testnet new '{
  "owner_id": "atlas_audit_2.velar.testnet",
  "metadata": {
    "spec": "ft-1.0.0",
    "name": "Atlas BTC",
    "symbol": "atBTC",
    "icon": "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27100%27%20height=%27100%27%20viewBox=%270%200%20100%20100%27%3E%3Crect%20width=%27100%25%27%20height=%27100%25%27%20fill=%27%23e67e22%27/%3E%3Ctext%20x=%2750%25%27%20y=%2750%25%27%20font-family=%27Tahoma%27%20font-size=%2720%27%20font-weight=%27bold%27%20fill=%27white%27%20text-anchor=%27middle%27%20dominant-baseline=%27middle%27%3EatBTC%3C/text%3E%3C/svg%3E",
    "reference": null,
    "reference_hash": null,
    "decimals": 8
  }
}' --accountId velar.testnet

near view  atbtc_audit_2.velar.testnet mint_deposit '{"account_id": "starz.testnet", "amount": "0", "btc_txn_hash": "b9d04109fba919d0f3b686c86c9b3c90bac2eab0e9a96c9a4ec90c9dee76e406"}'


near deploy atbtc_audit_2_v.velar.testnet res/atbtc.wasm
near call atbtc_audit_2_v.velar.testnet new '{
  "owner_id": "atlas_audit_2_v.velar.testnet",
  "metadata": {
    "spec": "ft-1.0.0",
    "name": "Atlas BTC",
    "symbol": "atBTC",
    "icon": "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27100%27%20height=%27100%27%20viewBox=%270%200%20100%20100%27%3E%3Crect%20width=%27100%25%27%20height=%27100%25%27%20fill=%27%23e67e22%27/%3E%3Ctext%20x=%2750%25%27%20y=%2750%25%27%20font-family=%27Tahoma%27%20font-size=%2720%27%20font-weight=%27bold%27%20fill=%27white%27%20text-anchor=%27middle%27%20dominant-baseline=%27middle%27%3EatBTC%3C/text%3E%3C/svg%3E",
    "reference": null,
    "reference_hash": null,
    "decimals": 8
  }
}' --accountId velar.testnet


near delete-account atlas_audit_2_v.velar.testnet velar.testnet
near create-account atlas_audit_2_v.velar.testnet --masterAccount velar.testnet --initialBalance 10
near deploy atlas_audit_2_v.velar.testnet res/atlas_protocol.wasm
near call atlas_audit_2_v.velar.testnet new '{"atlas_owner_id": "velar.testnet", "atlas_admin_id": "yeowlin.testnet", "global_params_owner_id": "velar.testnet", "chain_configs_owner_id": "velar.testnet", "treasury_address": "tb1pa4xwtgs3672h38rqdveyk5w9jqczfhjxh89j8erdlr59yj92qs8szyvw53", "production_mode": false}' --accountId velar.testnet
near view atlas_audit_2_v.velar_v.testnet get_all_chain_configs
near view atlas_audit_2_v.velar.testnet get_all_global_params
near view atlas_audit_2_v.velar.testnet get_all_deposits
near view atlas_audit_2_v.velar.testnet get_all_redemptions
near view atlas_audit_2_v.velar.testnet get_all_bridgings


near call atlas_audit_2_v.velar.testnet update_fee_deposit_bps '{"fee_deposit_bps": 300}' --accountId velar.testnet

near call atlas_audit_2_v.velar.testnet set_chain_configs_from_json '{"new_json_data": '"$(jq -Rs '.' < chain_chains_manual.json)"'}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "059d2b4f880b2a7718bd8bd12d82e652cb1d16470812eb7da7dfce2854d59dff"}' --accountId velar.testnet


near call atlas_audit_2_v.velar.testnet create_abtc_accept_ownership_tx '{"chain_id": "421614", "nonce": 1, "gas": 1000000, "max_fee_per_gas": 1000000000, "max_priority_fee_per_gas": 100000000}' --accountId velar.testnet --gas 300000000000000 --deposit 0
near call atlas_audit_2_v.velar.testnet update_fee_deposit_bps '{"fee_deposit_bps": 0}' --accountId velar.testnet --gas 300000000000000 
near call atlas_audit_2_v.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "efbba979dfa135d5bed3a57a587bdb858c1c959cb518f58eea6aade430dd670c"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet update_fee_redemption_bps '{"fee_redemption_bps": 0}' --accountId velar.testnet --gas 300000000000000 
near call atlas_audit_2_v.velar.testnet rollback_redemption_status_by_txn_hash '{"txn_hash": "11155420,0x0c9f04013de052e67965c60cc82f18faf08e2ab3e95700589686cb75e9a63e42"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet rollback_bridging_status_by_txn_hash '{"txn_hash": "421614,0xa657b351db888fb3ffbcc7cbaa3d2c12680e65c4f1e0f1ec81720dfa509fa4f8"}' --accountId velar.testnet


near call atlas_audit_2_v.velar.testnet update_redemption_yield_provider_withdrawing '{"txn_hash": "421614,0xcdabdb5c1d6f0c888995c71e38300bc09d8f94f5f2ccae77d1c7b98050fa0c29", "yield_provider_txn_hash": "c976a791e3c1454d4cdc5c504cb5931f8a3a56c4067bff437edbb6525f8efb1e", "yield_provider_gas_fee": 1768}' --accountId yeowlin.testnet
near call atlas_audit_2_v.velar.testnet update_redemption_pending_btc_mempool '{"txn_hash": "11155420,0x0c9f04013de052e67965c60cc82f18faf08e2ab3e95700589686cb75e9a63e42", "btc_txn_hash": "3344451a0c527828c1c439012b50071634c82d766aeaf1dd9cecf957b2b8661c", "estimated_fee": 1128, "protocol_fee": 0}' --accountId yeowlin.testnet

near call atlas_audit_2_v.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet

near call atlas_audit_2_v.velar.testnet clear_all_deposits --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet clear_all_redemptions --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet clear_all_bridgings --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet clear_all_validators --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet clear_all_verifications --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet clear_all_chain_configs --accountId velar.testnet
near delete-account atlas_audit_2_v.velar.testnet velar.testnet
near create-account atlas_audit_2_v.velar.testnet --masterAccount velar.testnet --initialBalance 10

near view atlas_audit_2_v.velar.testnet get_bridgings_by_dest_chain_id_and_address '{"dest_chain_id": "421614", "dest_chain_address": "0x0000000000000000000000000000000000000000"}'

near view atlas_audit_2_v.velar.testnet get_bridgings_by_timestamp '{"timestamp": 1712985600}'

near view atlas_audit_2_v.velar.testnet get_bridgings_by_status '{"status": 10}'

near view atlas_audit_2_v.velar.testnet get_all_verifications

near view atlas_audit_2_v.velar.testnet get_validators_by_txn_hash '{"txn_hash": "421614,0xa657b351db888fb3ffbcc7cbaa3d2c12680e65c4f1e0f1ec81720dfa509fa4f8"}'

near call atlas_audit_2_v.velar.testnet check_bridging_records_integrity {} --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet check_redemption_records_integrity {} --accountId velar.testnet

near call atlas_audit_2_v.velar.testnet rollback_bridging_status_by_txn_hash '{"txn_hash": "11155420,0xce7a78a53a90ec9c03e26513ad9369a0723f10052dbe14b1e3d07f8a0079984d"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet rollback_bridging_yield_provider_status_by_txn_hash '{"txn_hash": "421614,0xab494789a3675a0fd9a2d6d315154446ec373ba3e514a7e1874745aeafc3b8e3"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet get_first_valid_bridging_fees_unstake {} --accountId velar.testnet
near view atlas_audit_2_v.velar.testnet get_all_global_params


near call atlas_audit_2_v.velar.testnet rollback_bridging_yield_provider_status_by_txn_hash '{"txn_hash": "421614,0x6d2d7b03d85732256341dbc94a3a74afa3632d645e219613c7f4598ffd2d5d0c"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet rollback_bridging_yield_provider_status_by_txn_hash '{"txn_hash": "421614,0x3cdde3b5895bf1b62c860eb69d77c13b97c9d78c9ee97f0bd525e6d39b630ae5"}' --accountId velar.testnet

near call atlas_audit_2_v.velar.testnet update_bridging_timestamp '{"txn_hash": "421614,0x6d2d7b03d85732256341dbc94a3a74afa3632d645e219613c7f4598ffd2d5d0c", "timestamp": 1739898430}' --accountId velar.testnet


near call atlas_audit_2_v.velar.testnet update_bridging_remarks '{"txn_hash": "421614,0x03cddc2f41b91ffdf2e5096126d2699247d46a18c03c1f831aeafeff181b41e9", "remarks": "test"}' --accountId velar.testnet


near deploy atbtc_testnet4_v2.velar.testnet res/atbtc.wasm
near call atbtc_testnet4_v2.velar.testnet new '{
  "owner_id": "atlas_testnet4_v2.velar.testnet",
  "metadata": {
    "spec": "ft-1.0.0",
    "name": "Atlas BTC",
    "symbol": "atBTC",
    "icon": "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27100%27%20height=%27100%27%20viewBox=%270%200%20100%20100%27%3E%3Crect%20width=%27100%25%27%20height=%27100%25%27%20fill=%27%23e67e22%27/%3E%3Ctext%20x=%2750%25%27%20y=%2750%25%27%20font-family=%27Tahoma%27%20font-size=%2720%27%20font-weight=%27bold%27%20fill=%27white%27%20text-anchor=%27middle%27%20dominant-baseline=%27middle%27%3EatBTC%3C/text%3E%3C/svg%3E",
    "reference": null,
    "reference_hash": null,
    "decimals": 8
  }
}' --accountId velar.testnet


near call atlas_testnet4_v2.velar.testnet clear_all_deposits --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet clear_all_redemptions --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet clear_all_bridgings --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet clear_all_validators --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet clear_all_verifications --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet clear_all_chain_configs --accountId velar.testnet
near delete-account atlas_testnet4_v.velar.testnet velar.testnet
near create-account atlas_testnet4_v2.velar.testnet --masterAccount velar.testnet --initialBalance 10
near deploy atlas_testnet4_v2.velar.testnet res/atlas_protocol.wasm
near deploy atlas_testnet4_v.velar.testnet res/atlas_protocol.wasm --initFunction migrate --initGas 300000000000000

near call atlas_testnet4_v2.velar.testnet new '{"atlas_owner_id": "velar.testnet", "atlas_admin_id": "yeowlin.testnet", "global_params_owner_id": "velar.testnet", "chain_configs_owner_id": "velar.testnet", "treasury_address": "tb1pa4xwtgs3672h38rqdveyk5w9jqczfhjxh89j8erdlr59yj92qs8szyvw53", "production_mode": false}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet set_chain_configs_from_json '{"new_json_data": '"$(jq -Rs '.' < chain_chains_manual.json)"'}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "TESTNET4"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "66633666"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "80002"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "11155111"}' --accountId velar.testnet

near view atlas_testnet4_v2.velar.testnet get_all_validators
near view atlas_testnet4_v2.velar.testnet get_all_global_params

near view atlas_testnet4_v2.velar.testnet get_all_deposits
near call atlas_testnet4_v2.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "5ee79be531d49ea5fab4dc8f4c112fae99bbbdd5b933050002f5dff0ebea9881"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_redemption_status_by_txn_hash '{"txn_hash": "11155420,0x626bfe7bd4f91c2924f9a0039b3d381b7568887945480e905438875817ae43c1"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_bridging_yield_provider_status_by_txn_hash '{"txn_hash": "421614,0x7e898766750e7f1da033bd7734019bd7e352d6ac541ebc5a71abdb44bcac5717"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_bridging_status_by_txn_hash '{"txn_hash": "NEAR_TESTNET,86hMeHFbAuJP79kja17QfM87fNUgk1EntecgxhXcRbJJ"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet update_bridging_timestamp '{"txn_hash": "NEAR_TESTNET,86hMeHFbAuJP79kja17QfM87fNUgk1EntecgxhXcRbJJ", "timestamp": 1740451011}' --accountId velar.testnet
near view atlas_testnet4_v2.velar.testnet get_redemptions_for_yield_provider_by_status_and_timestamp '{"status": 10, "timestamp": 1740564473871}'
near call atlas_testnet4_v2.velar.testnet update_redemption_yield_provider_unstake_processing '{"txn_hash": "NEAR_TESTNET,jsvzKpY8GQwWLxvBNgiwhrnhaeArhQEBbiLV8wJqnrH"}' --accountId yeowlin.testnet
near call atlas_testnet4_v2.velar.testnet rollback_redemption_status_by_txn_hash '{"txn_hash": "NEAR_TESTNET,jsvzKpY8GQwWLxvBNgiwhrnhaeArhQEBbiLV8wJqnrH"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet update_bridging_fees_yield_provider_unstake_processing '{"421614,0xfc3c09c4ad02a80068e05e0e74356bcb5e00507707e0ad31e3111e1338817659"}' --accountId yeowlin.testnet
near call atlas_testnet4_v2.velar.testnet update_fee_bridging_bps '{"fee_bridging_bps": 300}' --accountId velar.testnet

near call atlas_testnet4_v2.velar.testnet rollback_bridging_yield_provider_status_by_txn_hash '{"txn_hash": "NEAR_TESTNET,98WuRYgbvf1sQJb8ooV4DQBZf3ULksKWP4tmFJarLMag"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_redemption_status_by_txn_hash '{"txn_hash": "421614,0x95f60ce373a4f741de4c5bf3628f784da84288b7ce3b7f796cc81b2c587cf828"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_redemption_status_by_txn_hash '{"txn_hash": "421614,0x75b6c7cc578e299c508b2cb26b98300f7eb60cc5dcc1c8d307fa2a4c46c5c822"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_redemption_status_by_txn_hash '{"txn_hash": "421614,0x4178e41750a9157c75ad0080b09f35a4b89fe97fa837deda5a3e74c76f2a04d9"}' --accountId velar.testnet


near call atlas_testnet4_v2.velar.testnet update_fee_bridging_bps '{"fee_bridging_bps": 300}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet update_fee_redemption_bps '{"fee_redemption_bps": 300}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet update_fee_deposit_bps '{"fee_deposit_bps": 0}' --accountId velar.testnet 
near call atlas_testnet4_v2.velar.testnet update_redemption_pending_btc_mempool '{
  "txn_hashes": ["421614,0x8f8d79726044fde35122e493e46c03817f440597a5052a4d4e796baa56b633e3"] ,
  "btc_txn_hash": "d9ad2c14be7772d715b39bf1b1c5fad41a257b01ec05d6afa8800b07af9d18bc"
}' --accountId yeowlin.testnet
near view atlas_testnet4_v2.velar.testnet  verify_redemption_txn_hash_in_merkle_root '{"merkle_root": "6326423bfd858be18fbdae2515cbccc1d3135e7f4d91f3aa9305a57c1a99a207", "btc_txn_hash": "a8a25f778e9b5df3e35a845f8bd6543c56c83b607e4473ebfdf7d0f04888e01b", "txn_hash_to_verify": "421614,0x285e9c9c66353f1f31df45a29c8b4ab0ba89bb041f79537fe8bbaa9d2ea6b429"}'


near view atlas_testnet4_20250226.velar.testnet get_all_deposits

near call atlas_testnet4_v2.velar.testnet clear_all_bridgings --accountId velar.testnet

near call atlas_testnet4_v2.velar.testnet rollback_bridging_yield_provider_status_by_txn_hash '{"txn_hash": "421614,0x776acf26f0feb17284f80c35e38ff21ec9d7f9df3192e04ffd01851681b9fe8e"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_bridging_yield_provider_status_by_txn_hash '{"txn_hash": "11155420,0xb519417a3d1e74bee2b9c56f7ccca1cd8c91343e742c5574df73b0f8a5de310f"}' --accountId velar.testnet

near view atlas_testnet4_v2.velar.testnet verify_bridging_txn_hash_in_merkle_root '{"merkle_root": "00a7013e82f1776e6d333018bf8b3cc6fcd62d43c406f32f882dc66883408380", "treasury_btc_txn_hash": "19af10b5b990a5ccdb1853f245c9e69679975b327c63070937f4dfb15252ced3", "txn_hash_to_verify": "421614,0x2d9000c133a9441190f10c4be6c7a57cbedc0f9c1f9b11d132381534a7a38596"}'
near call atlas_testnet4_v2.velar.testnet rollback_redemption_status_by_txn_hash '{"txn_hash": "11155420,0xb757663d3a38482cce588093ed68feb12d506c9e1525131b241d1d86b84e211d"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_redemption_status_by_txn_hash '{"txn_hash": "421614,0x748858d70424988fbf8625e86859a47bdc049d762f75cd29260f12ac79ee25f3"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_bridging_status_by_txn_hash '{"txn_hash": "421614,0x6c69fdfa26ea96834ca40786ca1a9e85bab967ec5051efd6a70bc2836ab57f87"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet set_chain_configs_from_json '{"new_json_data": '"$(jq -Rs '.' < chain_chains_manual.json)"'}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "fbc98081a17e2350d79e8e7fc70bfe67276e6c98090f5e1f06f8b4d6f42f5a49"}' --accountId velar.testnet
near call atlas_testnet4_v2.velar.testnet rollback_bridging_status_by_txn_hash '{"txn_hash": "421614,0x3cef84fabb0cc2b887cd38a11f5280ec73768093f8f087ca7c7f622bbb532950"}' --accountId velar.testnet

near view v1.atlas_public_testnet.testnet get_all_global_params
near call v1.atlas_public_testnet.testnet update_treasury_address '{"treasury_address": "tb1qa54le8k7eavpf7cqfzxa7fs7kwa39sme28r34u"}' --accountId atlas_public_testnet.testnet

near view v1.atlas_public_testnet.testnet get_all_deposits
near call v1.atlas_public_testnet.testnet rollback_redemption_status_by_txn_hash '{"txn_hash": "421614,0x74f5c0e405f0f634b01209c3720cc0b7277c370a155ce0ed3b2361b302412840"}' --accountId atlas_public_testnet.testnet



near call v1.atlas_public_testnet.testnet set_chain_configs_from_json '{"new_json_data": '"$(jq -Rs '.' < chain_chains_manual.json)"'}' --accountId atlas_public_testnet.testnet
near call v1.atlas_public_testnet.testnet add_validator '{"account_id": "atlas_public_testnet_validator_2.testnet", "chain_id": "TESTNET4"}' --accountId atlas_public_testnet.testnet
near call v1.atlas_public_testnet.testnet add_validator '{"account_id": "atlas_public_testnet_validator_2.testnet", "chain_id": "421614"}' --accountId atlas_public_testnet.testnet
near call v1.atlas_public_testnet.testnet add_validator '{"account_id": "atlas_public_testnet_validator_2.testnet", "chain_id": "11155420"}' --accountId atlas_public_testnet.testnet
near call v1.atlas_public_testnet.testnet add_validator '{"account_id": "atlas_public_testnet_validator_2.testnet", "chain_id": "NEAR_TESTNET"}' --accountId atlas_public_testnet.testnet
near call v1.atlas_public_testnet.testnet add_validator '{"account_id": "atlas_public_testnet_validator_2.testnet", "chain_id": "66633666"}' --accountId atlas_public_testnet.testnet
near call v1.atlas_public_testnet.testnet add_validator '{"account_id": "atlas_public_testnet_validator_2.testnet", "chain_id": "80002"}' --accountId atlas_public_testnet.testnet
near call v1.atlas_public_testnet.testnet add_validator '{"account_id": "atlas_public_testnet_validator_2.testnet", "chain_id": "11155111"}' --accountId atlas_public_testnet.testnet
 

near call v1.atlas_public_testnet.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "94347d80b924c8a7d605db903aefdece3a7956d5b83df5b67d013374c3d26714"}' --accountId atlas_public_testnet.testnet
near call v1.atlas_public_testnet.testnet update_fee_bridging_bps '{"fee_bridging_bps": 300}' --accountId atlas_public_testnet.testnet
near call v1.atlas_public_testnet.testnet update_fee_redemption_bps '{"fee_redemption_bps": 300}' --accountId atlas_public_testnet.testnet









near deploy v1.atlas_public_testnet.testnet res/atlas_protocol.wasm

near create-account atbtc.atlas_public_testnet.testnet --masterAccount atlas_public_testnet.testnet --initialBalance 10
near deploy atbtc.atlas_public_testnet.testnet res/atbtc.wasm
near call atbtc.atlas_public_testnet.testnet new '{
  "owner_id": "v1.atlas_public_testnet.testnet",
  "metadata": {
    "spec": "ft-1.0.0",
    "name": "Atlas BTC",
    "symbol": "atBTC",
    "icon": "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27100%27%20height=%27100%27%20viewBox=%270%200%20100%20100%27%3E%3Crect%20width=%27100%25%27%20height=%27100%25%27%20fill=%27%23e67e22%27/%3E%3Ctext%20x=%2750%25%27%20y=%2750%25%27%20font-family=%27Tahoma%27%20font-size=%2720%27%20font-weight=%27bold%27%20fill=%27white%27%20text-anchor=%27middle%27%20dominant-baseline=%27middle%27%3EatBTC%3C/text%3E%3C/svg%3E",
    "reference": null,
    "reference_hash": null,
    "decimals": 8
  }
}' --accountId atlas_public_testnet.testnet