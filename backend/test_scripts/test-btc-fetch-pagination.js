const axios = require("axios");
const assert = require('assert');

const ADDRESS = "tb1q9ruq3vlgj79l27euc2wq79wxzae2t86z4adkkv"; // Example testnet4 address
const BASE_URL = "https://mempool.space/testnet4/api";
const POLLING_INTERVAL = 5000; // 5 seconds

// Keep track of transactions we've already seen
const seenTransactions = new Set();

async function fetchPendingTransactions(address) {
    let allTransactions = [];
    let lastSeenTxId = null;

    while (true) {
        // Construct API endpoint with pagination
        let url = `${BASE_URL}/address/${address}/txs`;
        if (lastSeenTxId) {
            url += `/chain/${lastSeenTxId}`;
        }

        try {
            const response = await axios.get(url);
            const transactions = response.data;

            if (transactions.length === 0) {
                break; // No more transactions to fetch
            }

            allTransactions.push(...transactions);
            lastSeenTxId = transactions[transactions.length - 1].txid; // Update pagination marker

            // Break if we have collected enough transactions
            if (allTransactions.length >= 200) {
                break;
            }
        } catch (error) {
            console.error("Error fetching transactions:", error);
            break;
        }
    }

    return allTransactions;
}

// Function to process new transactions
function processNewTransactions(transactions) {
    const newTransactions = transactions.filter(tx => !seenTransactions.has(tx.txid));
    
    if (newTransactions.length > 0) {
        console.log(`\n${new Date().toISOString()} - Found ${newTransactions.length} new pending transactions!`);
        
        newTransactions.forEach(tx => {
            console.log(`\nNew Transaction:`);
            console.log(`TXID: ${tx.txid}`);
            console.log(`Fee: ${tx.fee} sats`);
            console.log(`Size: ${tx.size} bytes`);
            console.log(`Status: ${tx.status.confirmed ? 'Confirmed' : 'Unconfirmed'}`);
            if (tx.status.confirmed) {
                console.log(`Block Height: ${tx.status.block_height}`);
                console.log(`Block Time: ${new Date(tx.status.block_time * 1000).toISOString()}`);
            }
            seenTransactions.add(tx.txid);
        });
    } else {
        process.stdout.write('.');  // Show activity without newline
    }
}

// Continuous monitoring function
async function monitorPendingTransactions() {
    console.log(`Starting continuous monitoring for address: ${ADDRESS}`);
    console.log('Checking every 5 seconds... (Press Ctrl+C to stop)\n');

    while (true) {
        try {
            const txs = await fetchPendingTransactions(ADDRESS);
            processNewTransactions(txs);
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        } catch (err) {
            console.error("\nError during monitoring:", err);
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        }
    }
}

// Start the monitoring
monitorPendingTransactions();
