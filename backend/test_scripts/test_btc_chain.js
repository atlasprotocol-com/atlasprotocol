const axios = require('axios');

async function getTransactionChain(startTxId, address) {
    const transactions = [];
    let currentTxId = startTxId;
    let processedTxIds = new Set(); // Keep track of processed transaction IDs to avoid loops
    
    while (currentTxId && !processedTxIds.has(currentTxId)) {
        try {
            console.log('Fetching transactions for chain starting at:', currentTxId);
            const response = await axios.get(`https://mempool.space/testnet4/api/address/${address}/txs/chain/${currentTxId}`);
            const txs = response.data;
            
            if (!txs || txs.length === 0) {
                console.log('No more transactions found in chain');
                break;
            }

            // Add transactions to our list
            transactions.push(...txs);
            console.log(`Found ${txs.length} transactions in this batch`);
            
            // Mark current transaction as processed
            processedTxIds.add(currentTxId);
            
            // Get the first transaction's txid to continue the chain
            const firstTx = txs[0];
            if (!firstTx) {
                console.log('No valid transaction found in response');
                break;
            }
            
            // Use the first transaction's txid for the next iteration
            currentTxId = firstTx.txid;
            console.log('Next chain will use transaction:', currentTxId);
            
        } catch (error) {
            console.error('Error fetching transaction chain:', error.message);
            break;
        }
    }
    
    if (processedTxIds.has(currentTxId)) {
        console.log('Stopping: Transaction already processed to avoid infinite loop');
    }
    
    return transactions;
}

// Example usage
const startTxId = '91b8ec1acf9b781ecf4ffac4048fba03f0fbdf5c0790bee6f964996e9b5ca63b';
const address = 'tb1q9ruq3vlgj79l27euc2wq79wxzae2t86z4adkkv';

getTransactionChain(startTxId, address)
    .then(transactions => {
        console.log('\nSummary:');
        console.log('Total transactions found:', transactions.length);
        console.log('\nTransaction details:');
        transactions.forEach(tx => {
            console.log('TxID:', tx.txid);
            const value = tx.vout.find(v => v.scriptpubkey_address === address)?.value;
            console.log('Value to address:', value ? `${value / 100000000} BTC` : 'No direct value');
            console.log('Timestamp:', new Date(tx.status.block_time * 1000).toISOString());
            console.log('---');
        });
    })
    .catch(error => {
        console.error('Error:', error.message);
    });
