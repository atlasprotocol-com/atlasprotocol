const { Bitcoin } = require('../services/bitcoin');
const { getConstants } = require('../constants');

async function testUnconfirmedTransactionTime() {
    try {
        const { NETWORK_TYPE, RPC_URLS } = getConstants();
        
        // Initialize Bitcoin service
        const bitcoin = new Bitcoin('https://mempool.space/testnet4/api', 'testnet');
        
        // Test transaction hash (you can replace this with any unconfirmed transaction hash)
        const testTx = {
            txid: "a316edd81b060d64206fe3c7f4bad893d4150a5a5d17d3a98aa27c4cbb93c604" // Replace with actual unconfirmed transaction hash
        };

        console.log("Testing fetchUnconfirmedTransactionTime...");
        console.log("Transaction hash:", testTx.txid);
        
        const unconfirmedTime = await bitcoin.fetchUnconfirmedTransactionTime(testTx);
        console.log("Unconfirmed transaction time:", unconfirmedTime);
        
    } catch (error) {
        console.error("Error in test:", error.message);
    }
}

// Run the test
testUnconfirmedTransactionTime(); 