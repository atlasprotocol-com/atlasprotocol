const { Bitcoin } = require('../services/bitcoin');

async function testOpReturnDecoding() {
    // Initialize Bitcoin service with mainnet
    const bitcoinService = new Bitcoin('https://mempool.space/testnet4/api');
    
    // Transaction hash to test
    const txHash = 'cbb3a9246b6ae8d48e2c6e4e016ed42b82a5ce32fc8d2f7b6b1b1888333772a1';
    
    try {
        // Fetch the transaction
        const txn = await bitcoinService.fetchTxnByTxnID(txHash);
        
        // Get OP_RETURN data
        const result = await bitcoinService.getChainAndAddressFromTxnHash(txn);
        
        console.log('OP_RETURN Data:');
        console.log('Chain:', result.chain);
        console.log('Address:', result.address);
        console.log('Yield Provider Gas Fee:', result.yieldProviderGasFee);
        console.log('Protocol Fee:', result.protocolFee);
        console.log('Minting Fee:', result.mintingFee);
        console.log('Remarks:', result.remarks);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run the test
testOpReturnDecoding(); 