const axios = require('axios');
const { connect, keyStores, utils, keyStores: { InMemoryKeyStore } } = require('near-api-js');
const path = require('path');
const homedir = require('os').homedir();

const { Bitcoin } = require('./services/bitcoin');

// Initialize Bitcoin instance
const bitcoin = new Bitcoin('https://mempool.space/testnet4/api', 'testnet');

async function getUnconfirmedOutgoingTransactions(address) {
    try {
        const unconfirmedCount = await bitcoin.getPendingOutCount(address);
        console.log(`Found ${unconfirmedCount} unconfirmed outgoing transactions`);
        return unconfirmedCount;
    } catch (error) {
        console.error('Error fetching unconfirmed transactions:', error.message);
        throw error;
    }
}

async function findDepositWithRemark() {
    try {
        // Configure NEAR connection
        const keyStore = new keyStores.UnencryptedFileSystemKeyStore(path.join(homedir, '.near-credentials'));
        
        const config = {
            networkId: "testnet",
            keyStore,
            nodeUrl: "https://rpc.testnet.fastnear.com",
        };

        // Connect to NEAR
        const near = await connect(config);
        const account = await near.account("v2.atlas_public_testnet.testnet");

        // Call the contract to get deposits with remarks
        const deposits = await account.viewFunction({
            contractId: "v2.atlas_public_testnet.testnet",
            methodName: "get_deposits_with_remarks",
            args: {}
        });

        console.log("Deposits counts:", deposits.length);
        // The specific error message we're looking for
        const errorMessage = 'Error staking to yield provider: TRPCClientError: sendrawtransaction RPC error: {"code":-26,"message":"too-long-mempool-chain, too many unconfirmed ancestors [limit: 25]"} - undefined';
        
        // Find the first deposit with the exact error message in remarks
        const targetDeposit = deposits.find(deposit => 
            deposit.remarks === errorMessage
        );

        if (targetDeposit) {
            console.log("Found deposit with the specific error message:", targetDeposit);
            console.log("Deposit details:");
            console.log("- Remarks:", targetDeposit.remarks);
            console.log("- Other deposit data:", JSON.stringify(targetDeposit, null, 2));

            // Reprocess the deposit
            await reprocessDeposit(targetDeposit.btc_txn_hash);
        } else {
            console.log("No deposits found with the specific error message");
            console.log("Available deposits:", deposits);
        }

        return targetDeposit;
    } catch (error) {
        console.error('Error fetching NEAR deposits:', error.message);
        throw error;
    }
}

async function reprocessDeposit(btcTxnHash) {
    try {
        // Configure NEAR connection with credentials
        const keyStore = new keyStores.UnencryptedFileSystemKeyStore(path.join(homedir, '.near-credentials'));
        
        const config = {
            networkId: "testnet",
            keyStore,
            nodeUrl: "https://rpc.testnet.fastnear.com",
        };

        // Connect to NEAR
        const near = await connect(config);
        
        // Use the same account as in the NEAR CLI command
        const account = await near.account("atlas_public_testnet.testnet");

        console.log(`Reprocessing deposit with BTC transaction hash: ${btcTxnHash}`);

        // Call the rollback function
        const result = await account.functionCall({
            contractId: "v2.atlas_public_testnet.testnet",
            methodName: "rollback_deposit_status_by_btc_txn_hash",
            args: {
                btc_txn_hash: btcTxnHash
            },
            gas: "300000000000000", // Standard gas amount
            deposit: "0" // No deposit needed for this call
        });

        console.log("Reprocessing successful:", result);
        return result;
    } catch (error) {
        console.error('Error reprocessing deposit:', error.message);
        throw error;
    }
}

// The testnet4 address to check
const testnetAddress = 'tb1q9ruq3vlgj79l27euc2wq79wxzae2t86z4adkkv';

// Execute functions with condition
async function main() {
    try {
        const unconfirmedCount = await getUnconfirmedOutgoingTransactions(testnetAddress);
        
        // if (unconfirmedCount < 20) {
        //     console.log('Unconfirmed transactions less than 20, checking deposits with remarks...');
        //     await findDepositWithRemark();
        // } else {
        //     console.log('Unconfirmed transactions count is 20 or more, skipping deposit check');
        // }
    } catch (error) {
        console.error('Script execution failed:', error);
        process.exit(1);
    }
}

main();
