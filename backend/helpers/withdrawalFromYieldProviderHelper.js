const fs = require('fs');
const path = require('path');

const WITHDRAWAL_DATA_PATH = path.join(__dirname, '../utils/yieldProviderWithdrawal/lastWithdrawalTxHash.json');
const RECORDS_FILE_PATH = path.join(__dirname, '../utils/yieldProviderWithdrawal/records.json');

class WithdrawalFromYieldProviderHelper {
    static async getLastWithdrawalData() {
        try {
            if (fs.existsSync(WITHDRAWAL_DATA_PATH)) {
                const data = fs.readFileSync(WITHDRAWAL_DATA_PATH, 'utf8');
                return JSON.parse(data);
            }
            return {
                lastWithdrawalTxHash: '',
                withdrawalFee: 0,
                totalNewAmount: 0,
                totalRecords: 0,
                readySendToUser: false,
                errorMessage: '',
                sendToUserBtcTxnHash: ''
            };
        } catch (error) {
            console.error('Error reading withdrawal data:', error);
            return {
                lastWithdrawalTxHash: '',
                withdrawalFee: 0,
                totalNewAmount: 0,
                totalRecords: 0,
                readySendToUser: false,
                errorMessage: error.message,
                sendToUserBtcTxnHash: ''
            };
        }
    }

    static async updateLastWithdrawalData(data) {
        try {
            const currentData = await this.getLastWithdrawalData();
            const updatedData = {
                ...currentData,
                ...data
            };
            fs.writeFileSync(WITHDRAWAL_DATA_PATH, JSON.stringify(updatedData, null, 2));
            return updatedData;
        } catch (error) {
            console.error('Error updating withdrawal data:', error);
            throw error;
        }
    }

    static async clearLastWithdrawalData() {
        try {
            const defaultData = {
                lastWithdrawalTxHash: '',
                withdrawalFee: 0,
                totalNewAmount: 0,
                totalRecords: 0,
                readySendToUser: false,
                errorMessage: '',
                sendToUserBtcTxnHash: ''
            };
            fs.writeFileSync(WITHDRAWAL_DATA_PATH, JSON.stringify(defaultData, null, 2));
            return defaultData;
        } catch (error) {
            console.error('Error clearing withdrawal data:', error);
            throw error;
        }
    }

    static async writeRecordsToFile(records) {
        try {
            // Create directory if it doesn't exist
            const dir = path.dirname(RECORDS_FILE_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write records directly to file
            fs.writeFileSync(RECORDS_FILE_PATH, JSON.stringify(records, null, 2));
            return records;
        } catch (error) {
            console.error('Error writing records to file:', error);
            throw error;
        }
    }

    static async readRecordsFromFile() {
        try {
            if (fs.existsSync(RECORDS_FILE_PATH)) {
                const data = fs.readFileSync(RECORDS_FILE_PATH, 'utf8');
                if (!data || data.trim() === '') {
                    return [];
                }
                try {
                    return JSON.parse(data);
                } catch (parseError) {
                    console.error('Error parsing JSON from records file:', parseError);
                    return [];
                }
            }
            return [];
        } catch (error) {
            console.error('Error reading records from file:', error);
            return [];
        }
    }

    static async removeRecordFromFile(txnHash) {
        try {
            console.log(`[WithdrawalFromYieldProviderHelper] Attempting to remove record with txn_hash: ${txnHash}`);
            const records = await this.readRecordsFromFile();
            console.log(`[WithdrawalFromYieldProviderHelper] Current records before removal:`, JSON.stringify(records, null, 2));
            
            // Filter out the record with matching txn_hash
            const updatedRecords = records.filter(record => {
                // Handle both old string format and new object format
                if (typeof record === 'string') {
                    const shouldRemove = record !== txnHash;
                    console.log(`[WithdrawalFromYieldProviderHelper] Checking string record: ${record}, should remove: ${!shouldRemove}`);
                    return shouldRemove;
                } else if (typeof record === 'object' && record.txn_hash) {
                    const shouldRemove = record.txn_hash !== txnHash;
                    console.log(`[WithdrawalFromYieldProviderHelper] Checking object record: ${JSON.stringify(record, null, 2)}, should remove: ${!shouldRemove}`);
                    return shouldRemove;
                }
                return true; // Keep records that don't match either format
            });

            console.log(`[WithdrawalFromYieldProviderHelper] Records after filtering:`, JSON.stringify(updatedRecords, null, 2));

            // Write updated records back to file
            await this.writeRecordsToFile(updatedRecords);
            
            console.log(`[WithdrawalFromYieldProviderHelper] Successfully removed record with txn_hash: ${txnHash}`);
            console.log(`[WithdrawalFromYieldProviderHelper] Remaining records: ${updatedRecords.length}`);
            
            return updatedRecords;
        } catch (error) {
            console.error('[WithdrawalFromYieldProviderHelper] Error removing record from file:', error);
            throw error;
        }
    }

    static async clearAllRecords() {
        try {
            console.log('[WithdrawalFromYieldProviderHelper] Clearing all records from file');
            await this.writeRecordsToFile([]);
            console.log('[WithdrawalFromYieldProviderHelper] Successfully cleared all records');
            return [];
        } catch (error) {
            console.error('[WithdrawalFromYieldProviderHelper] Error clearing all records:', error);
            throw error;
        }
    }

    static async getRecordCount() {
        try {
            const records = await this.readRecordsFromFile();
            return records.length;
        } catch (error) {
            console.error('Error getting record count:', error);
            return 0;
        }
    }
}

module.exports = WithdrawalFromYieldProviderHelper;