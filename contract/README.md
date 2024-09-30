To deploy to testnet

Set 1:
Create new aBTC contract if needed for testnet

Step 2:

Check aBTC contract address for testnet and update this 2 files accordingly
1) atlasprotocol\backend\network.chain.config.js
2) atlasprotocol\src\config\network.chain.config.ts

Step 3:

Make sure this to files is pointing to testnet
1) atlasprotocol\backend\.env.local (Can use .env.testnet.example)
2) atlasprotocol\.env.local

Set 4: 

Run this commands in contract folder to delete all data and deploy new contract in testnet

If want to delete NEAR smart contract
near call atlas.yeowlin.testnet clear_all_deposits --accountId yeowlin.testnet
near call atlas.yeowlin.testnet clear_all_redemptions --accountId yeowlin.testnet
near call atlas.yeowlin.testnet clear_all_bridgings --accountId yeowlin.testnet
near delete-account atlas.yeowlin.testnet yeowlin.testnet

Create NEAR Subaccount (CLI)
near create-account atlas.yeowlin.testnet --masterAccount yeowlin.testnet --initialBalance 5

Deploy NEAR contract (CLI)
near deploy atlas.yeowlin.testnet res/atlas_protocol.wasm

Initialise NEAR contract (CLI)
near call atlas.yeowlin.testnet new '{"owner_id": "yeowlin.testnet", "treasury_address": "tb1pa4xwtgs3672h38rqdveyk5w9jqczfhjxh89j8erdlr59yj92qs8szyvw53"}' --accountId yeowlin.testnet