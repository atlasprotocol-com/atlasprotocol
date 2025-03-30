const { Bitcoin } = require('../services/bitcoin');

async function checkUtxoStatus() {
    try {
        // Initialize Bitcoin client for testnet4
        const bitcoin = new Bitcoin('https://mempool.space/testnet4/api', 'testnet');
        
        // Specific UTXO details
        const txid = 'de10cb2b3e6887534cdcdf8b243858b56ebd565f16da1df938060c5da17f912c';

        // Fetch transaction details
        const txn = await bitcoin.fetchTxnByTxnID(txid);
        
        console.log('Transaction Details:');
        console.log(`  txid: ${txid}`);
        console.log(`  Status: ${txn.status.confirmed ? 'Confirmed' : 'Unconfirmed'}`);
        
        if (txn.status.confirmed) {
            const confirmations = await bitcoin.getConfirmations(txn.status.block_height);
            console.log(`  Confirmations: ${confirmations}`);
            console.log(`  Block Height: ${txn.status.block_height}`);
            console.log(`  Block Time: ${new Date(txn.status.block_time * 1000).toLocaleString()}`);
        }

        console.log('\nOutputs:');
        for (let i = 0; i < txn.vout.length; i++) {
            const output = txn.vout[i];
            console.log(`\n  Output ${i}:`);
            console.log(`    Value: ${output.value} satoshis (${Bitcoin.toBTC(output.value)} BTC)`);
            console.log(`    Status: ${output.spent ? 'SPENT' : 'UNSPENT'}`);
            if (output.spent) {
                console.log(`    Spent in txid: ${output.spent_txid}`);
            }
        }
        
    } catch (error) {
        console.error('Error checking UTXO status:', error.message);
    }
}

// Execute the function
checkUtxoStatus();
