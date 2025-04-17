const fs = require('fs');
const path = require('path');

/**
 * Logs errors to a daily file with specified batch name
 * @param {string} btcTxnHash - The BTC transaction hash
 * @param {string} transactionHash - The transaction hash
 * @param {Error} error - The error object
 * @param {string} batchName - The name of the batch/process
 */
async function logErrorToFile(btcTxnHash, transactionHash, error, batchName) {
  const logsDir = path.join(__dirname, '..', 'logs');
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Create filename with current date and batch name
  const date = new Date().toISOString().split('T')[0];
  const logFile = path.join(logsDir, `${batchName}_${date}.log`);
  
  // Create log entry
  const logEntry = {
    timestamp: new Date().toISOString(),
    transaction: {
      btcTxnHash,
      transactionHash
    },
    error: {
      message: error.message || error.toString(),
      stack: error.stack || null
    }
  };

  // Read existing logs if file exists
  let logs = [];
  if (fs.existsSync(logFile)) {
    try {
      const fileContent = fs.readFileSync(logFile, 'utf8');
      logs = JSON.parse(fileContent);
    } catch (e) {
      console.error('Error reading existing log file:', e);
    }
  }

  // Add new log entry
  logs.push(logEntry);

  // Write updated logs back to file
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
}

module.exports = {
  logErrorToFile
}; 