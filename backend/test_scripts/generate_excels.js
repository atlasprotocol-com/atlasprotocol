// This script generates Excel files which contains different information.

// Configuration flags for file generation
const CONFIG = {
  GENERATE_DEPOSITS_XLSX: false,        // Set to true to enable deposits.xlsx generation
  GENERATE_DEPOSITS_QUEST2_XLSX: false,  // Set to true to enable deposits-quest2.xlsx generation
  GENERATE_UTXOS_XLSX: false,           // Set to true to enable UTXOs.xlsx generation
  GENERATE_PUBKEY_XLSX: false,          // Set to true to enable pubkeys.xlsx generation
  GENERATE_NEAR_BLOCKS_XLSX: true,      // Set to true to enable nearblocks.xlsx generation
  
  DEPOSITS: {
    OUTPUT_FILE: "deposits.xlsx",       // Output filename for deposits batch
    MAX_RECORDS: null,                  // Set to null for all records, or a number for limit
    BATCH_SIZE: 500                     // How many records to fetch per API call
  },
  
  DEPOSITS_QUEST2: {
    INPUT_FILE: "deposits-quest2.xlsx", // Fixed input file to read from and write to
    BATCH_SIZE: 50,                     // Number of rows to process in parallel
    SAVE_INTERVAL: 100                  // Save file every N rows processed
  },
  
  PUBKEY: {
    OUTPUT_FILE: "pubkeys.xlsx",        // Output filename for pubkeys batch
    BATCH_SIZE: 500,                    // How many records to fetch per API call
    SAVE_INTERVAL: 500                  // Save file every N records processed
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
    START_BLOCK: 189828205,            // Starting block number to scan from
    CONTRACT: "v2.atlas_public_testnet.testnet",  // Updated contract ID
    OUTPUT_FILE: "nearblocks.xlsx",    // Output filename
    SAVE_INTERVAL: 25,                  // Save file every N blocks processed
    WORKSHEET_NAME: "NEAR Blocks",     // Name of the worksheet in Excel file
    RPC_ENDPOINT: "https://neart.lava.build"  // NEAR RPC endpoint
  }
};

// Initialize NEAR provider
const { providers } = require("near-api-js");
const provider = new providers.JsonRpcProvider({ url: CONFIG.NEAR.RPC_ENDPOINT });

console.log("⏳ Starting script initialization...");

const { exec } = require("child_process");
const path = require("path");
const ExcelJS = require("exceljs");
const axios = require('axios');

/**
 * Fetches deposit records from NEAR using the CLI with pagination.
 */
async function fetchDeposits() {
  return new Promise((resolve, reject) => {
    let allDeposits = [];
    let fromIndex = 0;
    const limit = CONFIG.DEPOSITS.BATCH_SIZE;
    
    const fetchPage = () => {
      const command = `near view v2.atlas_public_testnet.testnet get_all_deposits '{"from_index": ${fromIndex}, "limit": ${limit}}'`;
      //console.log(`\n🔍 Executing command: ${command}`);
      
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
            const records = parseRecordsSeparately(stdout);
            console.log(`Parsed ${records.length} records from index ${fromIndex}`);
            
            // Add warning if records count is less than batch size
            if (records.length < limit) {
              console.log(`⚠️ Warning: Received ${records.length} records, expected ${limit} records`);
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
            
            fromIndex += limit;
            fetchPage(); // Fetch the next page
          } catch (e) {
            console.error("Failed to parse deposit records:", e);
            reject(e);
          }
        }
      );
    };

    fetchPage(); // Start fetching pages
  });
}

// Add these utility functions at the top of the file
function formatDate(date) {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '');
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
      throw e;
    }
  });
  
  return records;
}

/**
 * Exports deposit records to an Excel file using ExcelJS.
 */
async function exportToExcel(deposits) {
  const workbook = new ExcelJS.Workbook();
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
    { header: "Minted Txn Hash Verified Count", key: "minted_txn_hash_verified_count", width: 15 },

    // New simplified Burrow columns (Not used)
    { header: "Burrow Borrowed Tokens", key: "burrow_borrowed_tokens", width: 10 },
    { header: "Burrow Collateral Tokens", key: "burrow_collateral_tokens", width: 10 },
    
    // Add new column for active order pool IDs (Not used)
    { header: "Active Order Pool IDs", key: "active_order_pool_ids", width: 10 }
  ];
  
  // Add data rows
  deposits.forEach(deposit => {
    worksheet.addRow({
      // All existing deposit fields...
      btc_txn_hash: deposit.btc_txn_hash,
      btc_sender_address: deposit.btc_sender_address,
      receiving_chain_id: deposit.receiving_chain_id,
      receiving_address: deposit.receiving_address,
      btc_amount: deposit.btc_amount,
      protocol_fee: deposit.protocol_fee,
      minted_txn_hash: deposit.minted_txn_hash,
      minting_fee: deposit.minting_fee,
      timestamp: deposit.timestamp,
      formatted_timestamp: formatDate(new Date(deposit.timestamp / 1000000)),
      status: deposit.status,
      remarks: deposit.remarks,
      date_created: deposit.date_created,
      formatted_date_created: formatDate(new Date(deposit.date_created / 1000000)),
      verified_count: deposit.verified_count,
      yield_provider_gas_fee: deposit.yield_provider_gas_fee,
      yield_provider_txn_hash: deposit.yield_provider_txn_hash,
      retry_count: deposit.retry_count,
      minted_txn_hash_verified_count: deposit.minted_txn_hash_verified_count,
      
      // Set empty values for the last three columns
      burrow_borrowed_tokens: '',
      burrow_collateral_tokens: '',
      active_order_pool_ids: ''
    });
  });
  
  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  
  const filePath = path.join(__dirname, CONFIG.DEPOSITS.OUTPUT_FILE);
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Successfully exported ${deposits.length} deposit records to ${filePath}`);
}

/**
 * Checks if a deposit exists for a given BTC transaction hash
 */
async function checkDepositExists(btcTxnHash) {
  return new Promise(async (resolve, reject) => {
    const command = `near view v2.atlas_public_testnet.testnet get_deposit_by_btc_txn_hash '{"btc_txn_hash": "${btcTxnHash}"}'`;
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
  const workbook = new ExcelJS.Workbook();
  const filePath = path.join(__dirname, CONFIG.UTXOS.OUTPUT_FILE);
  
  try {
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    
    if (!worksheet) {
      console.log("ℹ️ No existing UTXOs file found or file is empty, will create new file");
      // Create a new workbook with the correct columns
      const newWorkbook = new ExcelJS.Workbook();
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
      const newWorkbook = new ExcelJS.Workbook();
      const newWorksheet = createUTXOWorksheet(newWorkbook);
      return { existingTxIds: new Set(), txIdToStatus: new Map(), workbook: newWorkbook, worksheet: newWorksheet };
    }
    // For any other error, still create a new workbook instead of throwing
    console.log(`ℹ️ Error reading UTXOs file: ${error.message}, will create new file`);
    const newWorkbook = new ExcelJS.Workbook();
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
    workbook = new ExcelJS.Workbook();
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
    const workbook = new ExcelJS.Workbook();
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
    let fromIndex = 0;
    const limit = CONFIG.PUBKEY.BATCH_SIZE;

    const fetchPage = () => {
      exec(
        `near view v2.atlas_public_testnet.testnet get_all_btc_pubkeys '{"from_index": ${fromIndex}, "limit": ${limit}}'`,
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
            console.log(`Parsed ${records.length} pubkey records from index ${fromIndex}`);
            
            allPubkeys = allPubkeys.concat(records);
            
            // If no more records, resolve
            if (records.length < limit) {
              return resolve(allPubkeys);
            }
            
            fromIndex += limit;
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
  const workbook = new ExcelJS.Workbook();
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
 * Main function to fetch and export UTXOs
 */
async function fetchAndExportUTXOs() {
  try {
    console.log("⏳ Fetching UTXO records from mempool.space...");
    const utxos = await fetchUTXOs();
    console.log(`✅ Retrieved ${utxos.length} UTXO records.`);
    
    // Process and export UTXOs in a single pass
    await processAndExportUTXOs(utxos);
  } catch (error) {
    console.error("❌ Error:", error);
  }
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

// Function to get block details
async function getBlockDetails(blockNumber) {
  try {
    const block = await provider.block({ blockId: blockNumber });
    return block;
  } catch (error) {
    console.error(`Error getting block ${blockNumber}: ${error.message}`);
    throw error;
  }
}

// Function to get the last block number from existing Excel file
async function getLastBlockFromExcel(filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(CONFIG.NEAR.WORKSHEET_NAME);
    
    if (!worksheet || worksheet.rowCount <= 1) { // Only header row
      return null;
    }
    
    // Get the last row
    const lastRow = worksheet.getRow(worksheet.rowCount);
    
    // Get the value from the first column of the last row
    const lastBlock = lastRow.getCell(1).value;
    
    if (lastBlock === undefined || lastBlock === null) {
      console.log('❌ No block number found in last row');
      return null;
    }
    
    return lastBlock;
  } catch (error) {
    console.error(`❌ Error reading existing Excel file: ${error.message}`);
    return null;
  }
}

// Function to clean up incomplete data from a specific block
async function cleanupIncompleteBlock(filePath, blockNumber) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(CONFIG.NEAR.WORKSHEET_NAME);
    
    if (!worksheet) {
      return;
    }
    
    // Find and remove all rows with the specified block number
    let rowIndex = worksheet.rowCount;
    while (rowIndex > 1) { // Skip header row
      const row = worksheet.getRow(rowIndex);
      if (row.getCell(1).value === blockNumber) {
        worksheet.spliceRows(rowIndex, 1);
      } else {
        break; // Stop when we find a row with a different block number
      }
      rowIndex--;
    }
    
    // Save the cleaned up file
    await workbook.xlsx.writeFile(filePath);
    console.log(`🧹 Cleaned up incomplete data from block ${blockNumber}`);
  } catch (error) {
    console.error(`❌ Error cleaning up incomplete block: ${error.message}`);
  }
}

// Add this new function before processAndExportBlocks
async function getTransactionHashFromReceiptId(receiptId) {
  try {
    const response = await axios.post(CONFIG.NEAR.RPC_ENDPOINT, {
      jsonrpc: "2.0",
      method: "EXPERIMENTAL_receipt",
      params: [receiptId],
      id: 1
    });
    
    if (response.data.error) {
      console.error(`Error getting receipt details: ${response.data.error.message}`);
      return null;
    }
    
    // The receipt data includes the transaction hash in the receipt object
    return response.data.result.receipt.transaction_hash;
  } catch (error) {
    console.error(`Error getting receipt details for receipt ${receiptId}: ${error.message}`);
    return null;
  }
}

// Add this new function before processAndExportBlocks
async function checkTransactionStatus(txHash) {
  try {
    const response = await axios.post(CONFIG.NEAR.RPC_ENDPOINT, {
      jsonrpc: "2.0",
      method: "EXPERIMENTAL_tx_status",
      params: [txHash],
      id: 1
    });
    
    if (response.data.error) {
      console.error(`Error checking transaction status: ${response.data.error.message}`);
      return false;
    }
    
    const status = response.data.result.status;
    // Check if the transaction was successful
    return status && (
      status.SuccessValue !== undefined || 
      status.SuccessReceiptId !== undefined
    );
  } catch (error) {
    console.error(`Error checking transaction status for ${txHash}: ${error.message}`);
    return false;
  }
}

// Add this function before processAndExportBlocks
function createNearBlocksWorksheet(workbook, existingWorksheet = null) {
  const worksheet = existingWorksheet || workbook.addWorksheet(CONFIG.NEAR.WORKSHEET_NAME);
  
  // Define columns
  worksheet.columns = [
    { header: "Near Block Number", key: "block_number", width: 15 },
    { header: "Timestamp Unix", key: "timestamp", width: 15 },
    { header: "Timestamp", key: "formatted_timestamp", width: 20 },
    { header: "Near Txn Hash", key: "txn_hash", width: 70 },
    { header: "Account ID", key: "account_id", width: 30 },
    { header: "atBTC Amount", key: "atbtc_amount", width: 15 },
    { header: "BTC Txn Hash", key: "btc_txn_hash", width: 70 },
    { header: "Event Type", key: "event_type", width: 20 }
  ];
  
  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  return worksheet;
}

// Main function to process blocks and export to Excel
async function processAndExportBlocks() {
  const startTime = new Date();
  console.log("\n🔍 Starting NEAR blocks processing...");
  console.log(`⏰ Batch start time: ${formatDate(startTime)}`);
  
  const filePath = path.join(__dirname, CONFIG.NEAR.OUTPUT_FILE);
  let workbook;
  let worksheet;
  
  try {
    // Check if file exists and get last block number
    const lastBlock = await getLastBlockFromExcel(filePath);
    if (lastBlock) {
      console.log(`📄 Found existing file with last block: ${lastBlock}`);
      // Clean up any incomplete data from the last block
      await cleanupIncompleteBlock(filePath, lastBlock);
      // Set START_BLOCK to the last block to process only new blocks
      CONFIG.NEAR.START_BLOCK = lastBlock;
      console.log(`🔄 Continuing from block: ${CONFIG.NEAR.START_BLOCK}`);
      
      // Load existing workbook
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      worksheet = workbook.getWorksheet(CONFIG.NEAR.WORKSHEET_NAME);
      
      // Define columns for existing worksheet
      worksheet = createNearBlocksWorksheet(workbook, worksheet);
    } else {
      // Create new workbook
      workbook = new ExcelJS.Workbook();
      worksheet = createNearBlocksWorksheet(workbook);
    }
    
    let lastSaveBlock = CONFIG.NEAR.START_BLOCK;
    
    // Get current block number
    //const currentBlock = 189828210;
    const currentBlock = await getCurrentBlock();
    console.log(`📊 Current block: ${currentBlock}`);
    console.log(`📊 Starting from block: ${CONFIG.NEAR.START_BLOCK}`);
    
    // Process each block
    for (let blockNumber = CONFIG.NEAR.START_BLOCK; blockNumber <= currentBlock; blockNumber++) {
      console.log(`\n⏳ Processing block ${blockNumber}/${currentBlock}`);
      
      try {
        // Get block details
        const blockData = await getBlockDetails(blockNumber);
        const blockTimestamp = blockData.header.timestamp;
        //console.log(`\n📊 Block Details:`, JSON.stringify(blockData, null, 2));        
        
        // Process each chunk in the block
        for (const chunk of blockData.chunks) {
          if (chunk.tx_root === "11111111111111111111111111111111") {
            continue;
          }
          
          // Get chunk details
          const chunkData = await provider.chunk(chunk.chunk_hash);
          
          if (!chunkData || !chunkData.transactions) {
            continue;
          }
          
          // Process each transaction in the chunk
          for (const tx of chunkData.transactions) {
            if (tx.receiver_id !== CONFIG.NEAR.CONTRACT) {
              continue;
            }
            
            // Get events using getPastEventsByMintedTxnHash
            const events = await getPastEventsByMintedTxnHash(tx.hash);
            
            for (const event of events) {
              if (event.type === "mint_deposit" && event.btcTxnHash) {
                const timestamp = new Date(blockTimestamp / 1000000);
                
                // Add row for the event
                const newRow = worksheet.addRow({
                  block_number: blockNumber,
                  timestamp: Math.floor(blockTimestamp / 1000000),
                  formatted_timestamp: formatDate(timestamp),
                  txn_hash: event.transactionHash,
                  account_id: event.accountId,
                  atbtc_amount: event.amount,
                  btc_txn_hash: event.btcTxnHash,
                  event_type: event.type
                });
                
                // Commit the new row
                await newRow.commit();
                
                console.log(`✅ Added row for event: ${event.type} with BTC txn hash: ${event.btcTxnHash}`);
              }
            }
          }
        }
        
        // Save based on SAVE_INTERVAL
        if (blockNumber - lastSaveBlock >= CONFIG.NEAR.SAVE_INTERVAL) {
          await workbook.xlsx.writeFile(filePath);
          console.log(`💾 Saved progress: ${blockNumber}/${currentBlock} blocks processed`);
          lastSaveBlock = blockNumber;
        }
        
        // Add a small delay to avoid rate limiting
        await delay(100);
        
      } catch (error) {
        console.error(`❌ Error processing block ${blockNumber}: ${error.message}`);
        continue;
      }
    }
    
    // Final save
    await workbook.xlsx.writeFile(filePath);
    const endTime = new Date();
    console.log(`\n✅ Successfully exported NEAR blocks data to ${filePath}`);
    console.log(`⏰ Batch end time: ${formatDate(endTime)}`);
    console.log(`⏱️ Duration: ${formatDuration(startTime, endTime)}`);
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

/**
 * Main function to execute the process.
 */
async function main() {
  const mainStartTime = new Date();
  console.log(`\n🚀 Main process starting at ${formatDate(mainStartTime)}`);
  
  try {
    if (CONFIG.GENERATE_DEPOSITS_XLSX) {
      const startTime = new Date();
      console.log(`\n⏳ Starting deposits.xlsx generation at ${formatDate(startTime)}`);
      
      console.log("⏳ Fetching deposit records from NEAR...");
      console.log(`ℹ️ Processing ${CONFIG.DEPOSITS.MAX_RECORDS === null ? 'all' : CONFIG.DEPOSITS.MAX_RECORDS} records`);
      const deposits = await fetchDeposits();
      console.log(`✅ Retrieved ${deposits.length} deposit records.`);

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
    
    const mainEndTime = new Date();
    console.log(`\n🏁 Main process completed at ${formatDate(mainEndTime)}`);
    console.log(`⏱️ Total Duration: ${formatDuration(mainStartTime, mainEndTime)}`);
    
  } catch (error) {
    const mainEndTime = new Date();
    console.error("❌ Error:", error);
    console.log(`🏁 Main process failed at ${formatDate(mainEndTime)}`);
    console.log(`⏱️ Total Duration: ${formatDuration(mainStartTime, mainEndTime)}`);
  }
}

async function getPastEventsByMintedTxnHash(mintedTxnHash) {
  try {
    const events = [];

    const txResult = await provider.txStatus(mintedTxnHash, CONFIG.NEAR.CONTRACT);

    // Find receipt with ft_mint event
    const receipt = txResult.receipts_outcome.find((outcome) =>
      outcome.outcome.logs.some((log) => {
        try {
          const event = JSON.parse(log.replace("EVENT_JSON:", ""));
          return event.event === "ft_mint";
        } catch (e) {
          return false;
        }
      }),
    );

    if (receipt && receipt.outcome.status.SuccessValue === "") {
      const logEntry = receipt.outcome.logs.find((log) => {
        try {
          const event = JSON.parse(log.replace("EVENT_JSON:", ""));
          return event.event === "ft_mint";
        } catch (e) {
          return false;
        }
      });

      if (logEntry) {
        const event = JSON.parse(logEntry.replace("EVENT_JSON:", ""));
        const memo = JSON.parse(event.data[0].memo);
        const amount = JSON.parse(event.data[0].amount);
        const btcTxnHash = memo.btc_txn_hash;
        const accountId = memo.address;

        events.push({
          type: "mint_deposit",
          btcTxnHash: btcTxnHash,
          accountId: accountId,
          amount: amount,
          receiptId: receipt.id,
          transactionHash: mintedTxnHash
        });
      }
    }

    return events;
  } catch (error) {
    console.error("Error getting past events by minted transaction hash:", error);
    return [];
  }
}

main();
