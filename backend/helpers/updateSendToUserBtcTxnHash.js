const WithdrawalFromYieldProviderHelper = require('../helpers/withdrawalFromYieldProviderHelper');

class UpdateSendToUserBtcTxnHash {
    static async verifyTransactionOutput(bitcoinInstance, txn, records) {
        const changeAddress = process.env.BTC_ATLAS_DEPOSIT_ADDRESS;
        
        console.log('Verifying transaction:', txn.txid);
        console.log('Transaction outputs:', JSON.stringify(txn.vout, null, 2));
        console.log('Records to match:', JSON.stringify(records, null, 2));
        
        const matchedRecords = [];
        const remainingRecords = [...records];
        
        // Check each output against records
        for (const vout of txn.vout) {
            if (!vout || !vout.scriptpubkey_address || !vout.value) continue;
            
            // Skip change address outputs
            if (vout.scriptpubkey_address === changeAddress) continue;
            
            console.log('Checking output:', {
                address: vout.scriptpubkey_address,
                amount: vout.value,
                recordAddresses: remainingRecords.map(r => r.btc_receiving_address),
                recordAmounts: remainingRecords.map(r => r.amount)
            });
            
            // Find matching record in remaining records
            const recordIndex = remainingRecords.findIndex(record => 
                record.btc_receiving_address === vout.scriptpubkey_address &&
                record.amount === vout.value
            );

            if (recordIndex !== -1) {
                const matchedRecord = remainingRecords[recordIndex];
                console.log('Found matching record:', matchedRecord);
                matchedRecords.push({
                    output: vout,
                    record: matchedRecord
                });
                // Remove matched record from remaining records
                remainingRecords.splice(recordIndex, 1);
            }
        }

        console.log('Matched records:', matchedRecords.length);
        console.log('Remaining records:', remainingRecords.length);

        return {
            isValid: remainingRecords.length === 0, // All records must be matched
            matchedRecords: matchedRecords,
            remainingRecords: remainingRecords
        };
    }

    static async updateBtcTxnHash(bitcoinInstance) {
        try {
            // Read the last withdrawal data
            const withdrawalData = await WithdrawalFromYieldProviderHelper.getLastWithdrawalData();
            if (!withdrawalData) {
                throw new Error('Failed to read withdrawal data');
            }

            console.log('Withdrawal data:', JSON.stringify(withdrawalData, null, 2));

            // Read records
            const records = await WithdrawalFromYieldProviderHelper.readRecordsFromFile();
            if (!records || records.length === 0) {
                throw new Error('No records found');
            }

            console.log('Records from file:', JSON.stringify(records, null, 2));

            // Check if we have a last withdrawal tx hash
            if (!withdrawalData.lastWithdrawalTxHash) {
                throw new Error('No last withdrawal transaction hash found');
            }

            // Check if we have a last withdrawal tx hash
            if (withdrawalData.sendToUserBtcTxnHash !== "") {
                throw new Error('Send to user BTC transaction hash must be blank');
            }

            // Check if readySendToUser is true
            if (!withdrawalData.readySendToUser) {
                throw new Error('readySendToUser must be true to update BTC transaction hash');
            }

            let currentTxid = withdrawalData.lastWithdrawalTxHash;
            let verifiedTransaction = null;
            let transactionChain = [];
            let remainingRecords = [...records];

            // Recursively check transactions until we find a match or exhaust the chain
            while (currentTxid) {
                console.log('Checking transaction:', currentTxid);
                const txn = await bitcoinInstance.fetchTxnByTxnID(currentTxid);
                if (!txn) {
                    console.log('Transaction not found:', currentTxid);
                    break;
                }

                transactionChain.push(txn.txid);
                const verification = await this.verifyTransactionOutput(bitcoinInstance, txn, remainingRecords);
                
                if (verification.isValid) {
                    verifiedTransaction = txn;
                    break;
                }

                // Update remaining records for next transaction check
                remainingRecords = verification.remainingRecords;

                // If no match, find the spending transaction
                const spendingTx = await bitcoinInstance.findSpendingTransaction(currentTxid, process.env.BTC_ATLAS_DEPOSIT_ADDRESS);
                if (!spendingTx) {
                    console.log('No spending transaction found for:', currentTxid);
                    break;
                }
                currentTxid = spendingTx;
            }

            if (!verifiedTransaction) {
                console.log('Transaction chain checked:', transactionChain);
                console.log('Remaining unmatched records:', remainingRecords);
                throw new Error('Could not find transactions matching all records in records.json');
            }

            // Update the withdrawal data with the verified BTC transaction hash
            await WithdrawalFromYieldProviderHelper.updateLastWithdrawalData({
                sendToUserBtcTxnHash: verifiedTransaction.txid
            });

            return {
                success: true,
                message: 'BTC transaction hash updated successfully after verification',
                data: withdrawalData
            };
        } catch (error) {
            console.error('Error updating BTC transaction hash:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
}

module.exports = UpdateSendToUserBtcTxnHash; 