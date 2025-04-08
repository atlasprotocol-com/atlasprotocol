// Add timing utility at the top
const startTime = process.hrtime();

function logTime(message) {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const milliseconds = (seconds * 1000) + (nanoseconds / 1000000);
  console.log(`[${milliseconds.toFixed(2)}ms] ${message}`);
}

logTime("Script started");

// This script generates Excel files which contains different information.

// Configuration flags for file generation
const CONFIG = {
  GENERATE_DEPOSITS_XLSX: false,        // Set to true to enable deposits.xlsx generation
  GENERATE_DEPOSITS_QUEST2_XLSX: true,  // Set to true to enable deposits-quest2.xlsx generation
  GENERATE_UTXOS_XLSX: false,           // Set to true to enable UTXOs.xlsx generation
  GENERATE_PUBKEY_XLSX: false,          // Set to true to enable pubkeys.xlsx generation
  GENERATE_NEAR_BLOCKS_XLSX: false,      // Set to true to enable nearblocks.xlsx generation
  GENERATE_DEPOSITS_STATUS_21_XLSX: false,     // Set to true to process deposits with status 21
  
  DEPOSITS: {
    OUTPUT_FILE: "deposits.xlsx",       // Output filename for deposits batch
    MAX_RECORDS: null,                  // Set to null for all records, or a number for limit
    BATCH_SIZE: 500,                    // How many records to fetch per API call
    START_INDEX: 0,                     // Starting index for fetching deposits
    END_INDEX: null,                    // Set to null for no end index, or a number to stop at
    PRINT_CLI_OUTPUT: false,            // Set to true to print raw CLI output
    COLUMNS: {
      BTC_TXN_HASH: 1,                  // Column index for BTC Txn Hash
      MINTED_TXN_HASH: 7,               // Column index for Minted Txn Hash
      STATUS: 11,                       // Column index for Status      
      REMARKS: 12                       // Column index for Remarks
    }
  },
  
  DEPOSITS_QUEST2: {
    INPUT_FILE: "deposits-quest2.xlsx", // Fixed input file to read from and write to
    BATCH_SIZE: 50,                     // Number of rows to process in parallel
    SAVE_INTERVAL: 100                  // Save file every N rows processed
  },
  
  PUBKEY: {
    OUTPUT_FILE: "pubkeys.xlsx",        // Output filename for pubkeys batch
    BATCH_SIZE: 500,                    // How many records to fetch per API call
    SAVE_INTERVAL: 500,                 // Save file every N records processed
    START_INDEX: 0                      // Starting index for fetching pubkeys
  },
  
  UTXOS: {
    OUTPUT_FILE: "UTXOs.xlsx",          // Output filename for UTXOs batch
    ATLAS_VAULT_ADDRESS: 'tb1q9ruq3vlgj79l27euc2wq79wxzae2t86z4adkkv',  // Atlas vault address on testnet4
    SAVE_INTERVAL: 50,                  // Save file every N rows processed
    STATUS: {
      DEPOSIT_EXISTS: "Deposit already exists",
      PROCESSING_INITIATED: "Processing initiated",
      PROCESSING_FAILED: "Processing failed",
      ERROR: "Error",
      YES: "Yes",
      NO: "No"
    }
  },
  
  NEAR: {
    //START_BLOCK: 189828204,            // Starting block number to scan from for first testnet deposit
    START_BLOCK: 191847350,            // Starting block number to scan from
    //CONTRACT: "atlas_testnet4_v2.velar.testnet",  // Atlas contract ID    
    CONTRACT: "v2.atlas_public_testnet.testnet",  // Atlas contract ID
    //ATBTC_CONTRACT: "atbtc_testnet4_v2.velar.testnet",  // ATBTC contract ID
    ATBTC_CONTRACT: "atbtc_v2.atlas_public_testnet.testnet",  // ATBTC contract ID
    OUTPUT_FILE_DEPOSIT: "nearblocks_deposit.xlsx",    // Output filename for deposit events
    OUTPUT_FILE_REDEEM: "nearblocks_redeem.xlsx",      // Output filename for redeem events
    ERROR_OUTPUT_FILE: "nearblocks_errors.txt",  // File to log block processing errors
    WORKSHEET_NAME: "NEAR Blocks",     // Name of the worksheet in Excel file
    RPC_ENDPOINT: "https://neart.lava.build",  // NEAR RPC endpoint
    //RPC_ENDPOINT: "https://rpc.testnet.fastnear.com",  // NEAR RPC endpoint    
    THREAD_COUNT: 10,                  // Number of parallel threads to process blocks
    BLOCKS_PER_THREAD: 5,              // Number of blocks each thread processes
    COLUMNS: {
      // Only include columns used in processDepositsStatus21
      NEAR_TXN_HASH: 4,                 // Column index for Near Txn Hash
      BTC_TXN_HASH: 7,                  // Column index for BTC Txn Hash      
    }
  },
  
  DEPOSITS_STATUS_21: {
    OUTPUT_FILE: "deposits-status-21.xlsx"  // Output filename for status 21 deposits
  },
};

logTime("CONFIG loaded");

// Define required dependencies for each feature
const FEATURE_DEPENDENCIES = {
  GENERATE_DEPOSITS_XLSX: ['excelJs'],
  GENERATE_DEPOSITS_QUEST2_XLSX: ['excelJs', 'axios'],
  GENERATE_UTXOS_XLSX: ['excelJs', 'axios'],
  GENERATE_PUBKEY_XLSX: ['excelJs'],
  GENERATE_NEAR_BLOCKS_XLSX: ['excelJs', 'nearApi'],
  GENERATE_DEPOSITS_STATUS_21_XLSX: ['excelJs', 'axios']
};

// Global variables for modules
let excelJs = null;
let axios = null;
let nearApi = null;
let provider = null;

// Optimized lazy loading functions
async function loadNearApi() {
  if (!nearApi) {
    logTime("Loading near-api-js...");
    nearApi = require("near-api-js");
    provider = new nearApi.providers.JsonRpcProvider({ url: CONFIG.NEAR.RPC_ENDPOINT });
    logTime("near-api-js loaded");
  }
  return nearApi;
}

async function loadExcelJS() {
  if (!excelJs) {
    logTime("Loading excelJs...");
    excelJs = require("exceljs");
    logTime("Loaded excelJs");
  }
  return excelJs;
}

async function loadAxios() {
  if (!axios) {
    logTime("Loading axios...");
    axios = require('axios');
    logTime("Loaded axios");
  }
  return axios;
}

console.log("⏳ Starting script initialization...");

// Only load essential built-in modules at startup
const { exec } = require("child_process");
const path = require("path");
const fs = require('fs').promises;

// Add these utility functions at the top of the file
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatDuration(startTime, endTime) {
  const durationMs = endTime - startTime;
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

// Add delay utility function at the top with other utility functions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Removes all curly braces from the remarks field value.
 * It searches for the substring between "remarks:" and ", date_created:".
 */
function removeCurlyBracesFromRemarks(text) {    
  // Use a regex with a lookahead for the delimiter (', date_created:')
  let newText = text.replace(/(remarks:\s*')([\s\S]*?)('(?=,\s*date_created:))/g, (match, prefix, content, suffix) => {
    // Remove curly braces from the captured content.
    let cleaned = content.replace(/[{}]/g, "");
    
    if (cleaned.includes("TRPCClientError") || cleaned.includes("yield provider")) {
        //console.log(cleaned);        
        cleaned = cleaned
            .replace(/(\\n|\n)/g, "")   // removes both literal "\n" and actual newline characters
            .replace(/\+/g, "")         // removes plus signs
            .replace(/[\[\]'"]/g, "")   // removes square brackets, single quotes, and double quotes
            .replace(/\:/g, "=")        // replaces : with =
            .replace(/\s+/g, " ")       // normalizes whitespace
            .trim();

        //console.log(cleaned);
    }
        
    return prefix + cleaned + suffix;
  });

  return newText;
}

/**
 * Fixes a single record's text into valid JSON.
 * First, it removes curly braces from the remarks field.
 * Then it removes newlines and plus signs,
 * encloses keys in double quotes,
 * converts single-quoted string values to double-quoted,
 * and finally removes any trailing commas.
 */
function fixRecordText(recordText) {
  let text = recordText;
  
  // Remove curly braces in the remarks field.
  text = removeCurlyBracesFromRemarks(text);
  //console.log(text);
  
  // Remove newline characters and plus signs.
  text = text.replace(/\r?\n/g, " ").replace(/\s*\+\s*/g, " ");
  
  // Enclose keys in double quotes.
  text = text.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*):/g, '$1"$2"$3:');
  
  // Convert single-quoted string values to double-quoted values.
  text = text.replace(/:\s*'([^']*)'/g, ': "$1"');
  
  // Remove trailing commas before } or ]
  text = text.replace(/,(\s*[}\]])/g, '$1');
  
  return text;
}

/**
 * A robust function to extract complete objects (from { to })
 * from the raw CLI output by walking through the characters
 * and balancing the braces (ignoring those inside string literals).
 */
function extractObjects(text) {
  const objects = [];
  let start = null;
  let depth = 0;
  let inString = false;
  let stringChar = null;
  let escaped = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    } else {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
      } else if (char === '{') {
        if (depth === 0) {
          start = i;
        }
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && start !== null) {
          objects.push(text.substring(start, i + 1));
          start = null;
        }
      }
    }
  }
  return objects;
}

/**
 * Splits the raw CLI output (after removing outer square brackets)
 * into individual record strings, fixes each record's text, and parses them as JSON.
 */
function parseRecordsSeparately(rawOutput) {
  let trimmed = rawOutput.trim();

  trimmed = trimmed.slice(trimmed.indexOf("[") + 1);
  //console.log('removed [');

  trimmed = trimmed.slice(0, trimmed.length - 1);
  //console.log('removed ]');
  
  //console.log(trimmed);
  
  // Extract complete objects using our custom function.
  const recordMatches = extractObjects(trimmed);
  if (!recordMatches || recordMatches.length === 0) {
    //throw new Error("No records found in the output.");
    return [];
  }
  
  const records = recordMatches.map(recordText => {
    try {
      const fixedText = fixRecordText(recordText);
      return JSON.parse(fixedText);
    } catch (e) {
      console.error("Failed to parse record:", recordText);
      return null;
    }
  });
  
  return records;
}

/**
 * Exports deposit records to an Excel file using ExcelJS.
 */
async function exportToExcel(deposits, filePath = null) {  
  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet("Deposits");
  
  worksheet.columns = [
    // Keep all existing deposit columns...
    { header: "BTC Txn Hash", key: "btc_txn_hash", width: 50 },
    { header: "BTC Sender Address", key: "btc_sender_address", width: 30 },
    { header: "Receiving Chain ID", key: "receiving_chain_id", width: 20 },
    { header: "Receiving Address", key: "receiving_address", width: 30 },
    { header: "BTC Amount", key: "btc_amount", width: 15 },
    { header: "Protocol Fee", key: "protocol_fee", width: 15 },
    { header: "Minted Txn Hash", key: "minted_txn_hash", width: 50 },
    { header: "Minting Fee", key: "minting_fee", width: 15 },
    { header: "Timestamp UNIX", key: "timestamp", width: 15 },
    { header: "Timestamp", key: "formatted_timestamp", width: 20 },
    { header: "Status", key: "status", width: 10 },
    { header: "Remarks", key: "remarks", width: 100 },
    { header: "Date Created UNIX", key: "date_created", width: 20 },
    { header: "Date Created", key: "formatted_date_created", width: 20 },
    { header: "Verified Count", key: "verified_count", width: 15 },
    { header: "Yield Provider Gas Fee", key: "yield_provider_gas_fee", width: 20 },
    { header: "Yield Provider Txn Hash", key: "yield_provider_txn_hash", width: 50 },
    { header: "Retry Count", key: "retry_count", width: 15 },
    { header: "Minted Txn Hash Verified Count", key: "minted_txn_hash_verified_count", width: 15 }
  ];
  
  // Add data rows
  deposits.forEach(deposit => {
    worksheet.addRow({
      btc_txn_hash: deposit.btc_txn_hash,
      btc_sender_address: deposit.btc_sender_address,
      receiving_chain_id: deposit.receiving_chain_id,
      receiving_address: deposit.receiving_address,
      btc_amount: deposit.btc_amount,
      protocol_fee: deposit.protocol_fee,
      minted_txn_hash: deposit.minted_txn_hash,
      minting_fee: deposit.minting_fee,
      timestamp: deposit.timestamp,
      formatted_timestamp: formatDate(new Date(deposit.timestamp * 1000)),
      status: deposit.status,
      remarks: deposit.remarks,
      date_created: deposit.date_created,
      formatted_date_created: formatDate(new Date(deposit.date_created * 1000)),
      verified_count: deposit.verified_count,
      yield_provider_gas_fee: deposit.yield_provider_gas_fee,
      yield_provider_txn_hash: deposit.yield_provider_txn_hash,
      retry_count: deposit.retry_count,
      minted_txn_hash_verified_count: deposit.minted_txn_hash_verified_count
    });
  });
  
  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  
  // Use provided filePath or default to CONFIG.DEPOSITS.OUTPUT_FILE
  const outputPath = filePath || path.join(__dirname, CONFIG.DEPOSITS.OUTPUT_FILE);
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Successfully exported ${deposits.length} deposit records to ${outputPath}`);
}

/**
 * Checks if a deposit exists for a given BTC transaction hash
 */
async function checkDepositExists(btcTxnHash) {
  return new Promise(async (resolve, reject) => {
    const command = `near view ${CONFIG.NEAR.CONTRACT} get_deposit_by_btc_txn_hash '{"btc_txn_hash": "${btcTxnHash}"}'`;
    //console.log(`\n🔍 Executing CLI command:\n${command}`);
    
    // Add 0.8 second delay before executing the command
    await delay(800);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error checking deposit: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`NEAR CLI stderr: ${stderr}`);
      }
      
      const output = stdout.trim();
      //console.log(`📄 Raw CLI output:\n${output}`);
      
      // Split into lines and check if any line starts with '{'
      const lines = output.split('\n');
      const depositExists = lines.some(line => line.trim().startsWith('{'));
      
      console.log(`📊 Deposit exists: ${depositExists}`);
      resolve(depositExists);
    });
  });
}

/**
 * Processes a new deposit via Atlas API
 */
async function processNewDeposit(btcTxnHash) {
  try {
    const response = await axios.get(`https://testnet.atlasprotocol.com/api/v1/process-new-deposit?btcTxnHash=${btcTxnHash}`);
    console.log(`✅ Successfully initiated deposit processing for ${btcTxnHash}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to process deposit for ${btcTxnHash}:`, error.message);
    throw error;
  }
}

/**
 * Creates a new UTXOs worksheet with the correct columns
 */
function createUTXOWorksheet(workbook) {
  const worksheet = workbook.addWorksheet("UTXOs");
  worksheet.columns = [
    { header: "Transaction ID", key: "txid", width: 70 },
    { header: "Output Index", key: "vout", width: 15 },
    { header: "Value (satoshis)", key: "value", width: 20 },
    { header: "Confirmed", key: "confirmed", width: 15 },
    { header: "Block Height", key: "block_height", width: 15 },
    { header: "Block Hash", key: "block_hash", width: 70 },
    { header: "Block Time", key: "block_time", width: 20 },
    { header: "Deposit Exists", key: "deposit_exists", width: 15 },
    { header: "Processing Status", key: "processing_status", width: 30 }
  ];
  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  return worksheet;
}

/**
 * Reads existing UTXOs from the Excel file and returns an array of transaction IDs
 * along with their processing status
 */
async function readExistingUTXOs() {
  const workbook = new excelJs.Workbook();
  const filePath = path.join(__dirname, CONFIG.UTXOS.OUTPUT_FILE);
  
  try {
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    
    if (!worksheet) {
      console.log("ℹ️ No existing UTXOs file found or file is empty, will create new file");
      // Create a new workbook with the correct columns
      const newWorkbook = new excelJs.Workbook();
      const newWorksheet = createUTXOWorksheet(newWorkbook);
      return { existingTxIds: new Set(), txIdToStatus: new Map(), workbook: newWorkbook, worksheet: newWorksheet };
    }
    
    const existingTxIds = new Set();
    const txIdToStatus = new Map();
    
    // Skip header row
    for (let row = 2; row <= worksheet.rowCount; row++) {
      const txId = worksheet.getCell(row, 1).text; // Transaction ID is in first column
      const status = worksheet.getCell(row, 9).text; // Processing Status is in 9th column
      existingTxIds.add(txId);
      txIdToStatus.set(txId, status);
    }
    
    console.log(`📊 Found existing UTXOs file at ${filePath}`);
    console.log(`📈 Total rows in file: ${worksheet.rowCount}`);
    console.log(`📝 Number of unique UTXOs: ${existingTxIds.size}`);
    return { existingTxIds, txIdToStatus, workbook, worksheet };
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`ℹ️ No existing UTXOs file found at ${filePath}, will create new file`);
      // Create a new workbook with the correct columns
      const newWorkbook = new excelJs.Workbook();
      const newWorksheet = createUTXOWorksheet(newWorkbook);
      return { existingTxIds: new Set(), txIdToStatus: new Map(), workbook: newWorkbook, worksheet: newWorksheet };
    }
    // For any other error, still create a new workbook instead of throwing
    console.log(`ℹ️ Error reading UTXOs file: ${error.message}, will create new file`);
    const newWorkbook = new excelJs.Workbook();
    const newWorksheet = createUTXOWorksheet(newWorkbook);
    return { existingTxIds: new Set(), txIdToStatus: new Map(), workbook: newWorkbook, worksheet: newWorksheet };
  }
}

/**
 * Process UTXOs and export to Excel in a single pass
 */
async function processAndExportUTXOs(utxos) {
  console.log("\n🔍 Processing and exporting UTXOs...");
  
  let workbook;
  let worksheet;
  let existingTxIds = new Set();
  let txIdToStatus = new Map();
  let lastSaveCount = 0; // Initialize to 0 to track processed UTXOs
  
  try {
    // Read existing UTXOs or create new workbook
    const result = await readExistingUTXOs();
    workbook = result.workbook;
    worksheet = result.worksheet;
    existingTxIds = result.existingTxIds;
    txIdToStatus = result.txIdToStatus;
    
    // Verify workbook and worksheet are properly initialized
    if (!workbook || !worksheet) {
      throw new Error("Failed to initialize workbook or worksheet");
    }
    
    console.log(`📊 Initial worksheet row count: ${worksheet.rowCount}`);
    console.log(`📊 Initial existing UTXOs count: ${existingTxIds.size}`);
  } catch (error) {
    console.error("❌ Error reading existing UTXOs:", error);
    // Create a new workbook if there was an error
    workbook = new excelJs.Workbook();
    worksheet = createUTXOWorksheet(workbook);
    console.log("ℹ️ Created new workbook due to error, will process all UTXOs");
  }
  
  const totalUTXOs = utxos.length;
  const filePath = path.join(__dirname, CONFIG.UTXOS.OUTPUT_FILE);
  
  // Process each UTXO and add to Excel in a single loop
  for (let i = 0; i < utxos.length; i++) {
    const utxo = utxos[i];
    console.log(`\n📝 Processing UTXO [${i + 1}/${totalUTXOs}]: ${utxo.txid}`);
    
    let depositExists = false;
    let processingStatus = '';
    
    try {
      // Check if deposit exists - wait for the result
      console.log(`⏳ [${i + 1}/${totalUTXOs}] Checking if deposit exists for ${utxo.txid}...`);
      depositExists = await checkDepositExists(utxo.txid);
      
      // Only proceed after we have a definitive answer about deposit existence
      if (!depositExists) {
        console.log(`ℹ️ [${i + 1}/${totalUTXOs}] No existing deposit found for ${utxo.txid}, initiating processing...`);
        try {
          await processNewDeposit(utxo.txid);
          console.log(`✅ [${i + 1}/${totalUTXOs}] Successfully initiated processing for ${utxo.txid}`);
          processingStatus = CONFIG.UTXOS.STATUS.PROCESSING_INITIATED;
        } catch (error) {
          console.error(`❌ [${i + 1}/${totalUTXOs}] Failed to process deposit for ${utxo.txid}: ${error.message}`);
          processingStatus = `${CONFIG.UTXOS.STATUS.PROCESSING_FAILED}: ${error.message}`;
        }
      } else {
        console.log(`ℹ️ [${i + 1}/${totalUTXOs}] Deposit already exists for ${utxo.txid}`);
        processingStatus = CONFIG.UTXOS.STATUS.DEPOSIT_EXISTS;
      }
    } catch (error) {
      console.error(`❌ [${i + 1}/${totalUTXOs}] Error processing UTXO ${utxo.txid}:`, error);
      processingStatus = `${CONFIG.UTXOS.STATUS.ERROR}: ${error.message}`;
    }
    
    // Check if UTXO exists in Excel file
    if (existingTxIds.has(utxo.txid)) {
      console.log(`ℹ️ [${i + 1}/${totalUTXOs}] UTXO ${utxo.txid} exists in file, updating record...`);
      
      // Find the row with this UTXO
      let rowNumber = 2; // Start from row 2 (after header)
      while (rowNumber <= worksheet.rowCount) {
        const row = worksheet.getRow(rowNumber);
        if (row.getCell(1).text === utxo.txid) {
          // Skip update if current status is already DEPOSIT_EXISTS
          if (row.getCell(9).value === CONFIG.UTXOS.STATUS.DEPOSIT_EXISTS) {
            console.log(`ℹ️ Skipping update for UTXO ${utxo.txid} - already marked as deposit exists`);
            break;
          }
          
          // Update the status in the Excel file
          row.getCell(8).value = depositExists ? CONFIG.UTXOS.STATUS.YES : CONFIG.UTXOS.STATUS.NO;
          row.getCell(9).value = processingStatus;
          await row.commit();
          console.log(`✅ Updated existing UTXO ${utxo.txid}`);
          break;
        }
        rowNumber++;
      }
    } else {
      console.log(`ℹ️ [${i + 1}/${totalUTXOs}] UTXO ${utxo.txid} not found in file, adding new record...`);
      
      // Log current row count before adding
      const beforeRowCount = worksheet.rowCount;
      console.log(`📊 Current row count before adding: ${beforeRowCount}`);
      
      // Add new row to Excel
      const newRow = worksheet.addRow();
      
      // Set values for each cell explicitly
      newRow.getCell(1).value = utxo.txid;
      newRow.getCell(2).value = utxo.vout;
      newRow.getCell(3).value = utxo.value;
      newRow.getCell(4).value = utxo.status.confirmed;
      newRow.getCell(5).value = utxo.status.block_height;
      newRow.getCell(6).value = utxo.status.block_hash;
      newRow.getCell(7).value = utxo.status.block_time;
      newRow.getCell(8).value = depositExists ? CONFIG.UTXOS.STATUS.YES : CONFIG.UTXOS.STATUS.NO;
      newRow.getCell(9).value = processingStatus;
      
      // Commit the new row
      await newRow.commit();
      
      // Log row count after adding
      const afterRowCount = worksheet.rowCount;
      console.log(`📊 Row count after adding: ${afterRowCount}`);
      
      // Update our tracking sets
      existingTxIds.add(utxo.txid);
      txIdToStatus.set(utxo.txid, processingStatus);
      console.log(`✅ Added new UTXO ${utxo.txid}`);
    }
    
    // Save based on SAVE_INTERVAL of processed UTXOs
    const processedCount = i + 1;
    if (processedCount - lastSaveCount >= CONFIG.UTXOS.SAVE_INTERVAL) {
      try {
        await workbook.xlsx.writeFile(filePath);
        console.log(`💾 Saved progress: ${processedCount}/${totalUTXOs} UTXOs processed (${worksheet.rowCount - 1} rows in file)`);
        lastSaveCount = processedCount;
      } catch (error) {
        console.error(`❌ Error saving file: ${error.message}`);
      }
    }
  }
  
  // Final save at the end of processing
  try {
    await workbook.xlsx.writeFile(filePath);
    console.log(`\n✅ Successfully processed and exported ${utxos.length} UTXO records to ${filePath}`);
    console.log(`📊 Total rows in file: ${worksheet.rowCount - 1}`); // Subtract 1 for header row
  } catch (error) {
    console.error(`❌ Error saving final file: ${error.message}`);
  }
}

/**
 * Fetches UTXO data from mempool.space API
 */
async function fetchUTXOs() {
  try {
    const address = CONFIG.UTXOS.ATLAS_VAULT_ADDRESS;
    const response = await axios.get(`https://mempool.space/testnet4/api/address/${address}/utxo`);
    
    // Filter out unconfirmed UTXOs and sort by block height (newest first)
    const confirmedUTXOs = response.data
      .filter(utxo => utxo.status.confirmed)
      .sort((a, b) => b.status.block_height - a.status.block_height);
    
    console.log(`Found ${response.data.length} total UTXOs (${confirmedUTXOs.length} confirmed) for Atlas vault address ${address}`);
    
    if (response.data.length !== confirmedUTXOs.length) {
      console.log(`Skipped ${response.data.length - confirmedUTXOs.length} unconfirmed UTXOs`);
    }
    
    return confirmedUTXOs;
  } catch (error) {
    console.error('Failed to fetch UTXOs:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Add the Burrow API functions to the existing file
 */
async function fetchBurrowAccountData(accountId) {
  // Convert accountId to lowercase if it contains uppercase characters
  const normalizedAccountId = accountId.toLowerCase();
  
  try {
    // Create custom axios instance that ignores SSL certificate errors
    const instance = axios.create({
      httpsAgent: new (require('https').Agent)({  
        rejectUnauthorized: false
      })
    });

    const response = await instance.get(`https://test-api.burrow.finance/get_account/${normalizedAccountId}`, {
      timeout: 10000 // 10 second timeout
    });
    return response.data;
  } catch (error) {
    if (error.code === 'CERT_HAS_EXPIRED') {
      console.log(`SSL Certificate error for ${accountId}, proceeding with empty data`);
    } else {
      console.log(`Failed to fetch Burrow data for account ${accountId}: ${error.message}`);
    }
    // Return a default empty response structure
    return {
      data: {
        account_id: accountId,
        booster_staking: {
          staked_booster_amount: "0",
          x_booster_amount: "0",
          unlock_timestamp: "0"
        },
        borrowed: []
      }
    };
  }
}

/**
 * Checks LP shares for a specific pool ID
 */
async function checkLPShares(accountId, poolId) {
  // Convert accountId to lowercase if it contains uppercase characters
  const normalizedAccountId = accountId.toLowerCase();
  
  return new Promise((resolve, reject) => {
    const command = `near view ref-finance-101.testnet get_pool_shares '{"account_id": "${normalizedAccountId}", "pool_id": ${poolId}}'`;
    // console.log(`\n🔍 Executing CLI command for ${normalizedAccountId} pool ${poolId}:\n${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error checking LP shares for ${accountId} pool ${poolId}: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`NEAR CLI stderr for ${accountId}: ${stderr}`);
      }
      
      const output = stdout.trim();
      // console.log(`📄 Raw CLI output for ${normalizedAccountId} pool ${poolId}:\n${output}`);
      
      try {
        // Get the last line which contains the actual value
        const lines = output.split('\n');
        const lastLine = lines[lines.length - 1].trim();
        
        // Remove any quotes and convert to number
        const valueStr = lastLine.replace(/['"]/g, '');
        const shares = Number(valueStr);
        
        // console.log(`📊 LP shares for ${accountId} pool ${poolId}: ${shares} (type: ${typeof shares})`);
        
        if (!isNaN(shares) && shares > 0) {
          // console.log(`📊 Found shares in pool ${poolId}`);
          return resolve(`${poolId}`);
        }
        resolve('');
      } catch (error) {
        console.error(`Error parsing LP shares for ${accountId} pool ${poolId}:`, error);
        resolve('');
      }
    });
  });
}

// Modify the processDepositsQuest2 function to check multiple pools
async function processDepositsQuest2() {
  console.log("\n🔍 Processing deposits-quest2.xlsx...");
  
  try {
    // Read the existing Excel file
    const workbook = new excelJs.Workbook();
    const filePath = path.join(__dirname, CONFIG.DEPOSITS_QUEST2.INPUT_FILE);
    // console.log(`📄 Reading file from ${filePath}`);
    await workbook.xlsx.readFile(filePath);
    
    // Get the first worksheet (either by index 1 or by getting the first worksheet)
    const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("Worksheet not found in deposits-quest2.xlsx");
    }
    
    // Log worksheet details for debugging
    // console.log(`📊 Found worksheet: "${worksheet.name}" with ${worksheet.rowCount} rows`);
    
    // Verify headers
    const expectedHeaders = ['Receiving Address', 'Burrow Borrowed Tokens', 'Burrow Collateral Tokens', 'ATBTC/WBTC LP Pool IDs'];
    const actualHeaders = worksheet.getRow(1).values.slice(1); // slice(1) to skip empty first cell
    
    if (!expectedHeaders.every((header, index) => header === actualHeaders[index])) {
      throw new Error("Excel file headers do not match expected format");
    }
    
    const totalRows = worksheet.rowCount;
    const totalRecords = totalRows - 1; // Exclude header row
    console.log(`Found ${totalRecords} records to process`);
    
    const POOL_IDS = [2482, 2483, 2492];
    let lastSaveRow = 0;
    let totalUpdated = 0;
    
    // Process rows in batches
    for (let startRow = 2; startRow <= totalRows; startRow += CONFIG.DEPOSITS_QUEST2.BATCH_SIZE) {
      const endRow = Math.min(startRow + CONFIG.DEPOSITS_QUEST2.BATCH_SIZE - 1, totalRows);
      const batchPromises = [];
      
      // Calculate display numbers (subtract 1 to account for header)
      const displayStart = startRow - 1;
      const displayEnd = endRow - 1;
      
      console.log(`\n📝 Processing batch [${displayStart}-${displayEnd}] of ${totalRecords}`);
      
      for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
        batchPromises.push((async () => {
          const row = worksheet.getRow(rowNumber);
          const receivingAddress = row.getCell(1).text;
          
          if (!receivingAddress) return null;
          
          let wasUpdated = false;
          
          // Check and update Burrow data
          const existingBorrowedTokens = row.getCell(2).text.toLowerCase();
          const existingCollateralTokens = row.getCell(3).text.toLowerCase();
          
          const hasExpectedTokens = existingBorrowedTokens.includes('usdc') && 
                                  existingCollateralTokens.includes('atbtc_v2');
          
          if (!hasExpectedTokens) {
            // console.log(`⏳ Checking Burrow data for ${receivingAddress}...`);
            try {
              const burrowData = await fetchBurrowAccountData(receivingAddress);
              if (burrowData && burrowData.data) {
                const borrowedTokens = burrowData.data.borrowed?.map(b => b.token_id).join(', ') || '';
                const collateralTokens = burrowData.data.collateral?.map(c => c.token_id).join(', ') || '';
                row.getCell(2).value = borrowedTokens;
                row.getCell(3).value = collateralTokens;
                wasUpdated = true;
                // console.log(`✅ Updated Burrow data for ${receivingAddress}`);
              }
            } catch (error) {
              console.error(`Error fetching Burrow data for ${receivingAddress}: ${error.message}`);
            }
          }
          // else {
          //   console.log(`ℹ️ Skipping Burrow check for ${receivingAddress} - has expected tokens`);
          // }
          
          // Check LP shares
          const existingLPShares = row.getCell(4).text;
          if (!existingLPShares.includes('true')) {
            // console.log(`⏳ Checking LP shares for ${receivingAddress}...`);
            try {
              const lpResults = await Promise.all(POOL_IDS.map(poolId => checkLPShares(receivingAddress, poolId)));
              const validResults = lpResults.filter(result => result !== '')
                .map(poolId => `${poolId}: true`);
              const newValue = validResults.join(', ');
              
              if (newValue) {
                row.getCell(4).value = newValue;
                wasUpdated = true;
                // console.log(`✅ Updated LP shares for ${receivingAddress}: ${newValue}`);
              }
            } catch (error) {
              console.error(`Error checking LP shares for ${receivingAddress}: ${error.message}`);
            }
          }
          // else {
          //   console.log(`ℹ️ Skipping LP check for ${receivingAddress} - already has shares`);
          // }
          
          return wasUpdated ? row : null;
        })());
      }
      
      // Wait for all rows in batch to complete
      const updatedRows = (await Promise.all(batchPromises)).filter(row => row !== null);
      totalUpdated += updatedRows.length;
      
      // Commit updated rows
      for (const row of updatedRows) {
        await row.commit();
      }
      
      // Save periodically to avoid data loss
      if (endRow - lastSaveRow >= CONFIG.DEPOSITS_QUEST2.SAVE_INTERVAL) {
        await workbook.xlsx.writeFile(filePath);
        console.log(`💾 Saved progress: ${endRow - 1}/${totalRecords} rows processed, total ${totalUpdated} rows updated`);
        lastSaveRow = endRow;
      }
    }
    
    // Final save
    await workbook.xlsx.writeFile(filePath);
    console.log(`\n✅ Successfully processed ${totalRecords} records, ${totalUpdated} were updated`);
    
  } catch (error) {
    console.error("❌ Error processing deposits-quest2.xlsx:", error);
    throw error;
  }
}

// Add new functions for pubkey processing
async function fetchPubkeys() {  
  return new Promise((resolve, reject) => {
    let allPubkeys = [];
    let startIndex = CONFIG.PUBKEY.START_INDEX;
    const limit = CONFIG.PUBKEY.BATCH_SIZE;

    const fetchPage = () => {
      exec(
        `near view ${CONFIG.NEAR.CONTRACT} get_all_btc_pubkeys '{"from_index": ${startIndex}, "limit": ${limit}}'`,
        { maxBuffer: 1024 * 1024 * 100 }, // 100 MB buffer
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error executing CLI command: ${error.message}`);
            return reject(error);
          }
          if (stderr) {
            console.error(`NEAR CLI stderr: ${stderr}`);
          }
          try {
            const records = parseRecordsSeparately(stdout);
            console.log(`Parsed ${records.length} pubkey records from index ${startIndex}`);
            
            allPubkeys = allPubkeys.concat(records);
            
            // If no more records, resolve
            if (records.length < limit) {
              return resolve(allPubkeys);
            }
            
            startIndex += limit;
            fetchPage(); // Fetch the next page
          } catch (e) {
            console.error("Failed to parse pubkey records:", e);
            reject(e);
          }
        }
      );
    };

    fetchPage(); // Start fetching pages
  });
}

async function exportPubkeysToExcel(pubkeys) {  
  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet("BTC Pubkeys");
  
  // Define columns based on BtcAddressPubKeyRecord struct
  worksheet.columns = [
    { header: "BTC Address", key: "btc_address", width: 70 },
    { header: "Public Key", key: "public_key", width: 70 },
    { header: "Staked", key: "staked", width: 10 }
  ];
  
  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  
  const filePath = path.join(__dirname, CONFIG.PUBKEY.OUTPUT_FILE);
  let lastSaveCount = 0;
  
  // Fetch all deposits first
  console.log("⏳ Fetching all deposit records to check staking status...");
  const deposits = await fetchDeposits();
  console.log(`✅ Retrieved ${deposits.length} deposit records`);
  
  // Create a Set of BTC addresses that have deposits
  const stakedAddresses = new Set(deposits.map(deposit => deposit.btc_sender_address));
  
  // Process pubkeys in batches
  for (let i = 0; i < pubkeys.length; i++) {
    const record = pubkeys[i];
    const isStaked = stakedAddresses.has(record.btc_address);
    
    // Add row with staking status
    worksheet.addRow({
      btc_address: record.btc_address,
      public_key: record.public_key,
      staked: isStaked ? "Yes" : "No"
    });
    
    // Save based on SAVE_INTERVAL
    const processedCount = i + 1;
    if (processedCount - lastSaveCount >= CONFIG.PUBKEY.SAVE_INTERVAL) {
      try {
        await workbook.xlsx.writeFile(filePath);
        console.log(`💾 Saved progress: ${processedCount}/${pubkeys.length} pubkey records processed`);
        lastSaveCount = processedCount;
      } catch (error) {
        console.error(`❌ Error saving file: ${error.message}`);
      }
    }
  }
  
  // Final save
  try {
    await workbook.xlsx.writeFile(filePath);
    console.log(`✅ Successfully exported ${pubkeys.length} pubkey records to ${filePath}`);
  } catch (error) {
    console.error(`❌ Error saving final file: ${error.message}`);
  }
}

/**
 * Fetches UTXOs and exports them to Excel in a single function
 */
async function fetchAndExportUTXOs() {
  console.log("⏳ Fetching UTXOs from mempool.space...");
  const utxos = await fetchUTXOs();
  console.log(`✅ Retrieved ${utxos.length} UTXOs`);
  
  console.log("⏳ Processing and exporting UTXOs to Excel...");
  await processAndExportUTXOs(utxos);
}

/**
 * Fetches deposit records from NEAR using the CLI with pagination.
 */
async function fetchDeposits() {
  return new Promise((resolve, reject) => {
    let allDeposits = [];
    let startIndex = CONFIG.DEPOSITS.START_INDEX;
    const limit = CONFIG.DEPOSITS.BATCH_SIZE;
    
    const fetchPage = () => {
      // Check if we've reached the end index
      if (CONFIG.DEPOSITS.END_INDEX !== null && startIndex >= CONFIG.DEPOSITS.END_INDEX) {
        console.log(`Reached configured end index of ${CONFIG.DEPOSITS.END_INDEX}`);
        return resolve(allDeposits);
      }
      
      // Adjust limit if we're close to the end index
      const adjustedLimit = CONFIG.DEPOSITS.END_INDEX !== null 
        ? Math.min(limit, CONFIG.DEPOSITS.END_INDEX - startIndex)
        : limit;
      
      const command = `near view ${CONFIG.NEAR.CONTRACT} get_all_deposits '{"from_index": ${startIndex}, "limit": ${adjustedLimit}}'`;
      
      if (CONFIG.DEPOSITS.PRINT_CLI_OUTPUT) {
        console.log(`\n🔍 Executing command: ${command}`);
      }
      
      exec(
        command,
        { maxBuffer: 1024 * 1024 * 100 }, // 100 MB buffer
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error executing CLI command: ${error.message}`);
            return reject(error);
          }
          if (stderr) {
            console.error(`NEAR CLI stderr: ${stderr}`);
          }
          try {
            if (CONFIG.DEPOSITS.PRINT_CLI_OUTPUT) {
              console.log(`📄 Raw CLI output:\n${stdout}`);
            }
            
            const records = parseRecordsSeparately(stdout);
            console.log(`Parsed ${records.length} records from index ${startIndex}`);
            
            // Add warning if records count is less than batch size
            if (records.length < adjustedLimit) {
              console.log(`⚠️ Warning: Received ${records.length} records, expected ${adjustedLimit} records`);
            }
            
            // Add records up to MAX_RECORDS limit if specified
            if (CONFIG.DEPOSITS.MAX_RECORDS !== null) {
              const remainingSlots = CONFIG.DEPOSITS.MAX_RECORDS - allDeposits.length;
              const recordsToAdd = records.slice(0, remainingSlots);
              allDeposits = allDeposits.concat(recordsToAdd);
              
              // If we've reached MAX_RECORDS, resolve
              if (allDeposits.length >= CONFIG.DEPOSITS.MAX_RECORDS) {
                console.log(`Reached configured limit of ${CONFIG.DEPOSITS.MAX_RECORDS} records`);
                return resolve(allDeposits);
              }
            } else {
              allDeposits = allDeposits.concat(records);
            }
            
            // If no more records or we've hit the limit, resolve
            if (records.length === 0) {
              return resolve(allDeposits);
            }
            
            startIndex += adjustedLimit;
            fetchPage(); // Fetch the next page
          } catch (e) {
            console.error("Failed to parse deposit records:", e);
            reject(e);
          }
        }
      );
    };
    
    // Start fetching
    fetchPage();
  });
}

// Function to get current block number
async function getCurrentBlock() {
  try {
    const latestBlock = await provider.block({ finality: "final" });
    return Number(latestBlock.header.height);
  } catch (error) {
    console.error(`Error getting current block: ${error.message}`);
    throw error;
  }
}

// Add this function before processAndExportBlocks
function createNearBlocksWorksheet(workbook, eventType) {
  const worksheet = workbook.addWorksheet(`${CONFIG.NEAR.WORKSHEET_NAME} ${eventType}`);
  
  // Define base columns that are common to both event types
  const baseColumns = [
    { header: "Near Block Number", key: "block_number", width: 15 },
    { header: "Timestamp Unix", key: "timestamp", width: 15 },
    { header: "Timestamp", key: "formatted_timestamp", width: 20 },
    { header: "Near Txn Hash", key: "tx_hash", width: 70 },
    { header: "Account ID", key: "account_id", width: 30 },
    { header: "atBTC Amount", key: "amount", width: 15 }
  ];

  // Add event-specific column based on event type
  if (eventType === "mint_deposit") {
    baseColumns.push({ header: "BTC Txn Hash", key: "btc_txn_hash", width: 70 });
  } else if (eventType === "burn_redeem") {
    baseColumns.push({ header: "BTC Address", key: "btc_address", width: 70 });
  }

  // Add event type column
  baseColumns.push({ header: "Event Type", key: "event_type", width: 20 });
  
  worksheet.columns = baseColumns;
  
  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  return worksheet;
}

// Add this new function before processAndExportBlocks
async function processBlockRange(startBlock, endBlock, threadId) {
  console.log(`\n🧵 Thread ${threadId}: Processing blocks ${startBlock} to ${endBlock}`);
  
  const depositResults = [];
  const redeemResults = [];
  const threadErrors = [];

  for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
    try {
      const block = await provider.block({ blockId: blockNumber });
      const chunks = block.chunks;

      for (const chunk of chunks) {
        if (chunk.tx_root === "11111111111111111111111111111111") {
          continue;
        }

        const chunkData = await provider.chunk(chunk.chunk_hash);
        const transactions = chunkData.transactions || [];

        for (const tx of transactions) {
          try {
            // Skip transactions not sent to our contracts
            if (tx.receiver_id !== CONFIG.NEAR.CONTRACT && tx.receiver_id !== CONFIG.NEAR.ATBTC_CONTRACT) {
              continue;
            }

            const txStatus = await provider.txStatus(tx.hash, tx.signer_id);
            const receipts = txStatus.receipts_outcome || [];

            // Process logs in a single loop
            for (const receipt of receipts) {
              const logs = receipt.outcome.logs || [];
              
              // Process logs in a single loop
              for (const log of logs) {
                if (log.includes("EVENT_JSON:")) {
                  
                  const eventData = JSON.parse(log.split("EVENT_JSON:")[1]);
                  const timestamp = Math.floor(block.header.timestamp / 1000000000);  // Convert from nanoseconds to seconds and round down
                  
                  let accountId = "";
                  let amount = "";
                  let btcInfo = "";

                  if (log.includes("ft_mint")) {
                                        
                    try {
                      // Get the first item from the data array
                      const mintData = eventData.data[0];
                      amount = mintData.amount;
                      
                      if (mintData.memo) {
                        const memo = JSON.parse(mintData.memo);
                        accountId = memo.address;
                        btcInfo = memo.btc_txn_hash;
                      }
                    } catch (error) {
                      console.error(`❌ Thread ${threadId}: Error parsing memo in block ${blockNumber}:`, error);
                    }                                        
                    
                    depositResults.push({
                      block_number: blockNumber,
                      timestamp: timestamp,
                      formatted_timestamp: formatDate(new Date(timestamp * 1000)),
                      tx_hash: tx.hash,
                      account_id: accountId,
                      amount: amount,
                      btc_txn_hash: btcInfo,
                      event_type: "mint_deposit"
                    });
                    console.log(`✅ Thread ${threadId}: Added deposit event in block ${blockNumber}`);
                  } else if (log.includes("ft_burn_redeem")) {

                    try {
                      // Get the first item from the data array
                      const redeemData = eventData.data[0];
                      amount = redeemData.amount;
                      accountId = redeemData.owner_id;
                      
                      if (redeemData.memo) {
                        const memo = JSON.parse(redeemData.memo);
                        
                        btcInfo = memo.btcAddress;
                      }
                    } catch (error) {
                      console.error(`❌ Thread ${threadId}: Error parsing memo in block ${blockNumber}:`, error);
                    }    

                    redeemResults.push({
                      block_number: blockNumber,
                      timestamp: timestamp,
                      formatted_timestamp: formatDate(new Date(timestamp * 1000)),
                      tx_hash: tx.hash,
                      account_id: accountId,
                      amount: amount,
                      btc_address: btcInfo,
                      event_type: "burn_redeem"
                    });
                    console.log(`✅ Thread ${threadId}: Added redeem event in block ${blockNumber}`);
                  }
                }
              }
            }
          } catch (error) {
            console.error(`❌ Thread ${threadId}: Error processing transaction in block ${blockNumber}:`, error);
            threadErrors.push(`Thread ${threadId}: Block ${blockNumber}, Tx ${tx.hash} - ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Thread ${threadId}: Error processing block ${blockNumber}:`, error);
      threadErrors.push(`Thread ${threadId}: Block ${blockNumber} - ${error.message}`);
    }

    // Add a small delay to avoid rate limiting
    await delay(200);
  }

  return { depositResults, redeemResults, threadErrors };
}

// Add this new function before processAndExportBlocks
async function saveBlockResultsToExcel(blockResults, filePath, eventType) {
  console.log(`\n💾 Attempting to save ${blockResults.length} ${eventType} events to ${filePath}`);
  
  // Create or load workbook
  const workbook = new excelJs.Workbook();
  const worksheetName = `${CONFIG.NEAR.WORKSHEET_NAME} ${eventType}`;
  let worksheet;
  
  try {
    // Try to load existing file
    await workbook.xlsx.readFile(filePath);
    worksheet = workbook.getWorksheet(worksheetName);
    
    if (!worksheet) {
      worksheet = createNearBlocksWorksheet(workbook, eventType);
    }
  } catch (error) {
    worksheet = createNearBlocksWorksheet(workbook, eventType);
  }
  
  // Sort results by block number to maintain sequence
  blockResults.sort((a, b) => a.block_number - b.block_number);
  
  // Add new rows with explicit column mapping
  for (const result of blockResults) {
    const newRow = worksheet.addRow();
    
    // Map each column explicitly using 1-based indices
    newRow.getCell(1).value = result.block_number;        // Near Block Number
    newRow.getCell(2).value = result.timestamp;           // Timestamp Unix
    newRow.getCell(3).value = result.formatted_timestamp; // Timestamp
    newRow.getCell(4).value = result.tx_hash;             // Near Txn Hash
    newRow.getCell(5).value = result.account_id;          // Account ID
    newRow.getCell(6).value = result.amount;              // atBTC Amount
    
    // Add event-specific column (7th column)
    if (eventType === "mint_deposit") {
      newRow.getCell(7).value = result.btc_txn_hash;      // BTC Txn Hash
    } else if (eventType === "burn_redeem") {
      newRow.getCell(7).value = result.btc_address;       // BTC Address
    }
    
    newRow.getCell(8).value = result.event_type;          // Event Type
    
    await newRow.commit();
  }
  
  // Save the file
  try {
    await workbook.xlsx.writeFile(filePath);
    console.log(`✅ Successfully saved ${blockResults.length} ${eventType} events to ${filePath}`);
  } catch (error) {
    console.error(`❌ Error saving file ${filePath}:`, error);
    throw error;
  }
}

// Add this new function before processAndExportBlocks
async function processBatch(startBlock, currentBlock, threadCount, blocksPerThread) {
  const totalBlocks = currentBlock - startBlock + 1;
  const totalBatches = Math.ceil(totalBlocks / (threadCount * blocksPerThread));
  const errorFilePath = path.join(__dirname, CONFIG.NEAR.ERROR_OUTPUT_FILE);
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStartTime = new Date();
    console.log(`\n🔄 Processing batch ${batchIndex + 1}/${totalBatches}`);
    console.log(`⏰ Batch start time: ${formatDate(batchStartTime)}`);
    
    const batchPromises = [];
    const batchStartBlock = startBlock + (batchIndex * threadCount * blocksPerThread);
    
    // Create thread tasks
    for (let threadIndex = 0; threadIndex < threadCount; threadIndex++) {
      const threadStartBlock = batchStartBlock + (threadIndex * blocksPerThread);
      const threadEndBlock = Math.min(threadStartBlock + blocksPerThread - 1, currentBlock);
      
      if (threadStartBlock <= currentBlock) {
        batchPromises.push(processBlockRange(threadStartBlock, threadEndBlock, threadIndex + 1));
      }
    }
    
    // Wait for all threads to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Flatten results and errors from all threads
    const allDepositResults = batchResults.flatMap(result => result.depositResults);
    const allRedeemResults = batchResults.flatMap(result => result.redeemResults);
    const allErrors = batchResults.flatMap(result => result.threadErrors);
    
    // Log errors to file if any occurred
    if (allErrors.length > 0) {
      try {
        await fs.appendFile(errorFilePath, allErrors.join('\n') + '\n');
        console.log(`⚠️ Logged ${allErrors.length} errors to ${errorFilePath}`);
      } catch (error) {
        console.error("Error writing to error file:", error);
      }
    }
    
    // Save results to Excel
    if (allDepositResults.length > 0) {
      const depositFilePath = path.join(__dirname, CONFIG.NEAR.OUTPUT_FILE_DEPOSIT);
      await saveBlockResultsToExcel(allDepositResults, depositFilePath, "mint_deposit");
      console.log(`💾 Saved batch ${batchIndex + 1} deposit results: ${allDepositResults.length} events processed`);
    }
    
    if (allRedeemResults.length > 0) {
      const redeemFilePath = path.join(__dirname, CONFIG.NEAR.OUTPUT_FILE_REDEEM);
      await saveBlockResultsToExcel(allRedeemResults, redeemFilePath, "burn_redeem");
      console.log(`💾 Saved batch ${batchIndex + 1} redeem results: ${allRedeemResults.length} events processed`);
    }
    
    const batchEndTime = new Date();
    console.log(`⏰ Batch end time: ${formatDate(batchEndTime)}`);
    console.log(`⏱️ Batch duration: ${formatDuration(batchStartTime, batchEndTime)}`);

    // Add a small delay between batches to avoid rate limiting
    await delay(300);
  }
}

// Modify the processAndExportBlocks function
async function processAndExportBlocks() {
  const startTime = new Date();
  console.log("\n🔍 Starting NEAR blocks processing...");
  console.log(`⏰ Batch start time: ${formatDate(startTime)}`);
  
  // Get the current block number
  const currentBlock = await getCurrentBlock();
  console.log(`Current block number: ${currentBlock}`);

  // Use START_BLOCK from config
  const startBlock = CONFIG.NEAR.START_BLOCK;
  console.log(`Starting from block ${startBlock} based on config`);

  // Process blocks in batches using the processBatch function
  await processBatch(
    startBlock,
    currentBlock,
    CONFIG.NEAR.THREAD_COUNT,
    CONFIG.NEAR.BLOCKS_PER_THREAD
  );
  
  console.log("\n✅ NEAR blocks processing completed");
}

async function processDepositsStatus21() {
  console.log("\n🔍 Processing deposits with status 21...");
  
  try {
    // Fetch all deposits
    console.log("⏳ Fetching all deposit records from NEAR...");
    const deposits = await fetchDeposits();
    console.log(`✅ Retrieved ${deposits.length} deposit records`);
    
    // Filter deposits with status 21, empty remarks, and empty minted txn hash
    const filteredDeposits = deposits.filter(deposit => 
      deposit.status === 21 && 
      (!deposit.remarks || deposit.remarks.trim() === '') && 
      (!deposit.minted_txn_hash || deposit.minted_txn_hash.trim() === '')
    );
    
    console.log(`📊 Found ${filteredDeposits.length} records matching criteria`);
    
    // Export filtered deposits to Excel
    const filePath = path.join(__dirname, CONFIG.DEPOSITS_STATUS_21.OUTPUT_FILE);
    await exportToExcel(filteredDeposits, filePath);
    
    // Read nearblocks.xlsx and create map of BTC Txn Hash to NEAR Txn Hash
    console.log("⏳ Reading nearblocks.xlsx to create transaction map...");
    const nearBlocksWorkbook = new excelJs.Workbook();
    const nearBlocksFilePath = path.join(__dirname, CONFIG.NEAR.OUTPUT_FILE_DEPOSIT);
    await nearBlocksWorkbook.xlsx.readFile(nearBlocksFilePath);
    
    const nearBlocksWorksheet = nearBlocksWorkbook.getWorksheet(1) || nearBlocksWorkbook.worksheets[0];
    if (!nearBlocksWorksheet) {
      throw new Error("Worksheet not found in nearblocks.xlsx");
    }
    
    // Create a map of BTC Txn Hash to NEAR Txn Hash
    const nearTxnMap = new Map();
    for (let rowNumber = 2; rowNumber <= nearBlocksWorksheet.rowCount; rowNumber++) {
      const row = nearBlocksWorksheet.getRow(rowNumber);
      const btcTxnHash = row.getCell(CONFIG.NEAR.COLUMNS.BTC_TXN_HASH).value;
      const nearTxnHash = row.getCell(CONFIG.NEAR.COLUMNS.NEAR_TXN_HASH).value;
      if (btcTxnHash && nearTxnHash) {
        nearTxnMap.set(btcTxnHash, nearTxnHash);
      }
    }
    console.log(`✅ Created map with ${nearTxnMap.size} NEAR transaction records`);
    
    // Now process each record by calling the API
    console.log("\n⏳ Processing records by calling API...");
    let successCount = 0;
    let failedCount = 0;
    let noMatchingNearTxn = 0;
    let filteredRecords = 0;
    
    for (const deposit of filteredDeposits) {
      filteredRecords++;
      console.log(`\n⏳ Processing record ${filteredRecords} of ${filteredDeposits.length}: ${deposit.btc_txn_hash}`);
      
      try {
        // Find corresponding NEAR transaction hash from map
        const nearTxnHash = nearTxnMap.get(deposit.btc_txn_hash);
        
        if (!nearTxnHash) {
          console.log(`⚠️ No matching NEAR transaction found for BTC Txn Hash: ${deposit.btc_txn_hash}`);
          noMatchingNearTxn++;
          failedCount++;
          continue;
        }
        
        // Call the API to check minted transaction
        console.log(`⏳ Initiating deposit processing for BTC Txn Hash: ${deposit.btc_txn_hash}`);
        try {
          const response = await axios.get(`https://testnet.atlasprotocol.com/api/v1/check-minted-txn?btcTxnHash=${deposit.btc_txn_hash}&mintedTxnHash=${nearTxnHash}`);
          
          if (response.data.success) {
            console.log(`✅ Successfully checked minted transaction for BTC Txn Hash: ${deposit.btc_txn_hash}`);
            successCount++;
          } else {
            console.log(`❌ Failed to check minted transaction for BTC Txn Hash: ${deposit.btc_txn_hash}: ${response.data.message}`);
            failedCount++;
          }
        } catch (error) {
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            const statusCode = error.response.status;
            const errorMessage = error.response.data?.message || 'Unknown error';
            
            if (statusCode === 504) {
              console.log(`❌ Gateway Timeout (504) for BTC Txn Hash ${deposit.btc_txn_hash}`);
            } else {
              console.log(`❌ API Error for BTC Txn Hash ${deposit.btc_txn_hash}: ${statusCode} - ${errorMessage}`);
            }
          } else if (error.request) {
            // The request was made but no response was received
            console.log(`❌ Network Error for BTC Txn Hash ${deposit.btc_txn_hash}: No response received`);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.log(`❌ Error for BTC Txn Hash ${deposit.btc_txn_hash}: ${error.message}`);
          }
          failedCount++;
        }
        
        // Add a small delay between API calls to avoid rate limiting
        await delay(500);
        
      } catch (error) {
        console.error(`❌ Error processing BTC Txn Hash ${deposit.btc_txn_hash}:`, error);
        failedCount++;
      }
    }
    
    // Print final summary
    console.log("\n📊 Final Processing Summary:");
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Failed to process: ${failedCount}`);
    console.log(`⚠️ No matching NEAR transaction: ${noMatchingNearTxn}`);
    
  } catch (error) {
    console.error("❌ Error processing deposits with status 21:", error);
    throw error;
  }
}

/**
 * Main function to execute the process.
 */
async function main() {
  const mainStartTime = new Date();
  console.log(`\n🚀 Main process starting at ${formatDate(mainStartTime)}`);
  
  try {
    // Preload dependencies based on enabled features
    const enabledFeatures = Object.entries(CONFIG)
      .filter(([key, value]) => typeof value === 'boolean' && value)
      .map(([key]) => key);
    
    const requiredDependencies = new Set();
    enabledFeatures.forEach(feature => {
      if (FEATURE_DEPENDENCIES[feature]) {
        FEATURE_DEPENDENCIES[feature].forEach(dep => requiredDependencies.add(dep));
      }
    });
    
    console.log("\n📦 Preloading required dependencies...");
    const preloadPromises = [];
    
    if (requiredDependencies.has('excelJs')) {
      preloadPromises.push(loadExcelJS());
    }
    if (requiredDependencies.has('nearApi')) {
      preloadPromises.push(loadNearApi());
    }
    if (requiredDependencies.has('axios')) {
      preloadPromises.push(loadAxios());
    }
    
    await Promise.all(preloadPromises);
    console.log("✅ Dependencies preloaded successfully");
    
    // Continue with initial processing
    if (CONFIG.GENERATE_DEPOSITS_XLSX) {
      const startTime = new Date();
      console.log("\n🔍 Starting deposits processing...");
      console.log(`⏰ Batch start time: ${formatDate(startTime)}`);
      
      // First, fetch all deposits
      console.log("⏳ Fetching deposit records from NEAR...");
      let deposits;
      try {
        deposits = await fetchDeposits();
        console.log(`✅ Retrieved ${deposits.length} deposit records.`);
      } catch (error) {
        console.error("❌ Failed to fetch deposits:", error);
        throw error;
      }
      
      // Export to Excel
      console.log("⏳ Exporting to Excel...");
      await exportToExcel(deposits);
      
      const endTime = new Date();
      console.log(`✅ Completed deposits.xlsx generation at ${formatDate(endTime)}`);
      console.log(`⏱️ Duration: ${formatDuration(startTime, endTime)}`);
    } else {
      console.log("\nℹ️  Skipping deposits.xlsx generation (disabled in CONFIG)");
    }
    
    if (CONFIG.GENERATE_DEPOSITS_QUEST2_XLSX) {
      const startTime = new Date();
      console.log(`\n⏳ Starting deposits-quest2.xlsx processing at ${formatDate(startTime)}`);
      
      await processDepositsQuest2();
      
      const endTime = new Date();
      console.log(`✅ Completed deposits-quest2.xlsx processing at ${formatDate(endTime)}`);
      console.log(`⏱️ Duration: ${formatDuration(startTime, endTime)}`);
    } else {
      console.log("\nℹ️  Skipping deposits-quest2.xlsx processing (disabled in CONFIG)");
    }
    
    if (CONFIG.GENERATE_PUBKEY_XLSX) {
      const startTime = new Date();
      console.log(`\n⏳ Starting pubkeys.xlsx generation at ${formatDate(startTime)}`);      
      
      console.log("⏳ Fetching pubkey records from NEAR...");
      const pubkeys = await fetchPubkeys();
      console.log(`✅ Retrieved ${pubkeys.length} pubkey records.`);
      
      console.log("⏳ Exporting to Excel...");
      await exportPubkeysToExcel(pubkeys);
      
      const endTime = new Date();
      console.log(`✅ Completed pubkeys.xlsx generation at ${formatDate(endTime)}`);
      console.log(`⏱️ Duration: ${formatDuration(startTime, endTime)}`);
    } else {
      console.log("\nℹ️  Skipping pubkeys.xlsx generation (disabled in CONFIG)");
    }
    
    if (CONFIG.GENERATE_UTXOS_XLSX) {
      const startTime = new Date();
      console.log(`\n⏳ Starting UTXOs.xlsx generation at ${formatDate(startTime)}`);
      
      await fetchAndExportUTXOs();
      
      const endTime = new Date();
      console.log(`✅ Completed UTXOs.xlsx generation at ${formatDate(endTime)}`);
      console.log(`⏱️ Duration: ${formatDuration(startTime, endTime)}`);
    } else {
      console.log("\nℹ️  Skipping UTXOs.xlsx generation (disabled in CONFIG)");
    }
    
    if (CONFIG.GENERATE_NEAR_BLOCKS_XLSX) {
      const startTime = new Date();
      console.log(`\n⏳ Starting nearblocks.xlsx generation at ${formatDate(startTime)}`);
      
      await processAndExportBlocks();
      
      const endTime = new Date();
      console.log(`✅ Completed nearblocks.xlsx generation at ${formatDate(endTime)}`);
      console.log(`⏱️ Duration: ${formatDuration(startTime, endTime)}`);
    } else {
      console.log("\nℹ️  Skipping nearblocks.xlsx generation (disabled in CONFIG)");
    }
    
    if (CONFIG.GENERATE_DEPOSITS_STATUS_21_XLSX) {
      const startTime = new Date();
      console.log(`\n⏳ Starting deposits status 21 processing at ${formatDate(startTime)}`);
      
      await processDepositsStatus21();
      
      const endTime = new Date();
      console.log(`✅ Completed deposits status 21 processing at ${formatDate(endTime)}`);
      console.log(`⏱️ Duration: ${formatDuration(startTime, endTime)}`);
    } else {
      console.log("\nℹ️  Skipping deposits status 21 processing (disabled in CONFIG)");
    }
    
    const mainEndTime = new Date();
    console.log(`\n🏁 Main process completed at ${formatDate(mainEndTime)}`);
    console.log(`⏱️ Total Duration: ${formatDuration(mainStartTime, mainEndTime)}`);
    
  } catch (error) {
    const mainEndTime = new Date();
    console.error("❌ Error:", error);
    console.log(`🏁 Main process failed at ${formatDate(mainEndTime)}`);
    console.log(`⏱️ Total Duration: ${formatDuration(mainStartTime, mainEndTime)}`);
  }

  // Add timing log at the end of the script
  logTime("Script completed");
}

// Start the main process
main().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});