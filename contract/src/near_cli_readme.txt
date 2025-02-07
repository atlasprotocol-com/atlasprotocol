near login

SMART CONTRACTS

Compile NEAR contract (CLI)

dos2unix ./build.sh
./build.sh

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
near call atlas_audit_2_v.velar.testnet update_fee_deposit_bps '{"fee_deposit_bps": 300}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet set_chain_configs_from_json '{"new_json_data": '"$(jq -Rs '.' < chain_chains_manual.json)"'}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "059d2b4f880b2a7718bd8bd12d82e652cb1d16470812eb7da7dfce2854d59dff"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet clear_all_deposits --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet clear_all_redemptions --accountId velar.testnet

near call atlas_audit_2_v.velar.testnet create_abtc_accept_ownership_tx '{"chain_id": "421614", "nonce": 1, "gas": 1000000, "max_fee_per_gas": 1000000000, "max_priority_fee_per_gas": 100000000}' --accountId velar.testnet --gas 300000000000000 --deposit 0
near call atlas_audit_2_v.velar.testnet update_fee_deposit_bps '{"fee_deposit_bps": 0}' --accountId velar.testnet --gas 300000000000000 
near call atlas_audit_2_v.velar.testnet rollback_deposit_status_by_btc_txn_hash '{"btc_txn_hash": "bfde44d3e2f90f08cd318d033de60521cb55464aec43b941c3f898d9c6cd04b9"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet update_fee_redemption_bps '{"fee_redemption_bps": 0}' --accountId velar.testnet --gas 300000000000000 
near call atlas_audit_2_v.velar.testnet rollback_redemption_status_by_txn_hash '{"txn_hash": "11155420,0x0c9f04013de052e67965c60cc82f18faf08e2ab3e95700589686cb75e9a63e42"}' --accountId velar.testnet

near call atlas_audit_2_v.velar.testnet update_redemption_yield_provider_withdrawing '{"txn_hash": "421614,0xcdabdb5c1d6f0c888995c71e38300bc09d8f94f5f2ccae77d1c7b98050fa0c29", "yield_provider_txn_hash": "c976a791e3c1454d4cdc5c504cb5931f8a3a56c4067bff437edbb6525f8efb1e", "yield_provider_gas_fee": 1768}' --accountId yeowlin.testnet
near call atlas_audit_2_v.velar.testnet update_redemption_pending_btc_mempool '{"txn_hash": "11155420,0x0c9f04013de052e67965c60cc82f18faf08e2ab3e95700589686cb75e9a63e42", "btc_txn_hash": "3344451a0c527828c1c439012b50071634c82d766aeaf1dd9cecf957b2b8661c", "estimated_fee": 1128, "protocol_fee": 0}' --accountId yeowlin.testnet

near call atlas_audit_2_v.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "SIGNET"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "421614"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "11155420"}' --accountId velar.testnet
near call atlas_audit_2_v.velar.testnet add_validator '{"account_id": "velar.testnet", "chain_id": "NEAR_TESTNET"}' --accountId velar.testnet