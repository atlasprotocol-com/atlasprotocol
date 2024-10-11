# Atlas Protocol

Atlas Protocol is a smart contract system built on the NEAR blockchain, designed to facilitate cross-chain transactions, particularly focusing on Bitcoin deposits and redemptions.

## Features

- Bitcoin deposit management
- Redemption handling
- Multi-chain support
- Validator system for transaction verification
- Fee management for deposits, redemptions, and bridging
- Flexible configuration system for different blockchain networks

## Smart Contract Structure

The Atlas Protocol smart contract is composed of several modules:

- `deposits`: Handles Bitcoin deposit operations
- `redemptions`: Manages redemption processes
- `admin`: Controls administrative functions and ownership
- `utils`: Provides utility functions and constants
- `validation`: Implements the validator system
- `fees`: Manages fee calculations for various operations
- `signer`: Handles signing operations for transactions

## Key Components

1. **Atlas**: The main contract struct that ties all components together.
2. **ChainConfigs**: Manages configurations for different blockchain networks.
3. **GlobalParams**: Stores global parameters like fees and staking limits.

## Setup and Deployment

To set up and deploy the Atlas Protocol:

1. Ensure you have Rust and the NEAR CLI installed.
2. Clone the repository:
   ```
   git clone https://github.com/your-repo/atlas-protocol.git
   cd atlas-protocol
   cd contract
   ```
3. Build the contract:
   ```
   ./build.sh
   ```
4. Deploy the contract to NEAR testnet:
   ```
   near deploy --accountId your-testnet-account.testnet --wasmFile res/atlas_protocol.wasm
   ```

## Testing

The project includes comprehensive unit tests for each module. To run the tests:

```
cargo test
```

## Usage

After deployment, interact with the contract using NEAR CLI or integrate it into your dApp. Here are some example interactions:

Insert a deposit
near call your-contract.testnet insert_deposit_btc '{"btc_txn_hash": "hash", "btc_sender_address": "address", ...}' --accountId your-account.testnet

Update a deposit status
near call your-contract.testnet update_deposit_btc_deposited '{"btc_txn_hash": "hash", "timestamp": 1234567890}' --accountId your-account.testnet

Insert a redemption
near call your-contract.testnet insert_redemption_abtc '{"txn_hash": "hash", "abtc_redemption_address": "address", ...}' --accountId your-account.testnet

Update global parameters
near call your-contract.testnet update_fee_deposit_bps '{"fee_deposit_bps": 100}' --accountId your-account.testnet

Add a validator
near call your-contract.testnet add_validator '{"account_id": "validator.testnet", "chain_id": "SIGNET"}' --accountId your-account.testnet