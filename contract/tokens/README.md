## Building

To build run:
```bash
./build.sh
```

Using this contract
===================

### deploy

near delete-account atbtc_10.velar.testnet velar.testnet
near create-account atbtc_10.velar.testnet --masterAccount velar.testnet --initialBalance 10
near deploy atbtc_10.velar.testnet res/atbtc.wasm

near call atbtc_10.velar.testnet new '{
  "owner_id": "atlas_revamp_10.velar.testnet",
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

near view atbtc_10.velar.testnet ft_metadata
near call atbtc_10.velar.testnet storage_deposit '{"account_id": "velar3.testnet"}' --accountId velar.testnet --amount 0.00125
near call atbtc_10.velar.testnet mint_deposit '{"account_id": "velar2.testnet", "amount": "100000", "btc_txn_hash": "Testing Hash"}' --accountId velar.testnet --gas 300000000000000

near view atbtc_10.velar.testnet ft_balance_of '{"account_id": "velar2.testnet"}'



// Bellow is for testing
near delete-account velar_ft6.velar.testnet velar.testnet
near create-account velar_ft6.velar.testnet --masterAccount velar.testnet --initialBalance 10
near deploy velar_ft6.velar.testnet res/atbtc.wasm

near call velar_ft6.velar.testnet new '{
  "owner_id": "velar.testnet",
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

near call velar_ft6.velar.testnet storage_deposit '{"account_id": "velar2.testnet"}' --accountId velar.testnet --amount 0.00125

near call velar_ft6.velar.testnet mint_deposit '{"account_id": "velar2.testnet", "amount": "100000", "btc_txn_hash": "Testing Hash"}' --accountId velar.testnet --gas 300000000000000

near call velar_ft6.velar.testnet mint_bridge '{"account_id": "velar2.testnet", "amount": "100000", "source_chain_id": "123", "source_chain_address": "abc"}' --accountId velar.testnet --gas 300000000000000

near call velar_ft.velar.testnet burn_redeem '{"amount": "10000", "btc_address": "tb1pprqtuhh8dncwe6pngrrpcs9y3sjn68v4z0w9afsc7anespevlzts7ymu0q"}' --accountId velar2.testnet --gas 300000000000000

near call velar_ft.velar.testnet burn_bridge '{"amount": "10000", "dest_chain_id": "123", "dest_chain_address" : "abc"}' --accountId velar2.testnet --gas 300000000000000

near view velar_ft.velar.testnet ft_metadata

near view velar_ft.velar.testnet get_price

near call velar_ft.velar.testnet set_price '{"new_price": "100000000"}' --accountId velar.testnet

near create-account atbtc_audit.velar.testnet --masterAccount velar.testnet --initialBalance 10
near deploy atbtc_audit.velar.testnet res/atbtc.wasm

near call atbtc_audit.velar.testnet new '{
  "owner_id": "atlas_audit.velar.testnet",
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