#!/bin/bash
near call atlas.yeowlin.testnet update_deposit_status '{"btc_txn_hash": "881c700dab0986e23e16ff019e5033a4192ff4cb3c54a19b4a2264dfd148ba47", "status": 10}' --accountId yeowlin.testnet
near call atlas.yeowlin.testnet update_deposit_remarks '{"btc_txn_hash": "881c700dab0986e23e16ff019e5033a4192ff4cb3c54a19b4a2264dfd148ba47", "remarks": ""}' --accountId yeowlin.testnet
