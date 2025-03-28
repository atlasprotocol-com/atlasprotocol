// Configuration flags for file generation
const CONFIG = {
  GENERATE_DEPOSITS_XLSX: false,         // Set to false to skip deposits.xlsx generation
  GENERATE_DEPOSITS_QUEST2_XLSX: true,  // Set to false to skip deposits-quest2.xlsx generation
  GENERATE_UTXOS_XLSX: false,           // Set to true to enable UTXOs.xlsx generation
  
  DEPOSITS: {
    MAX_RECORDS: null,            // Set to null for all records, or a number for limit
    BATCH_SIZE: 100,              // How many records to fetch per API call
    OUTPUT_FILE: "deposits.xlsx"  // Output filename for deposits batch
  },
  
  DEPOSITS_QUEST2: {
    INPUT_FILE: "deposits-quest2.xlsx"  // Fixed input file to read from and write to
  },
  
  UTXOS: {
    ATLAS_VAULT_ADDRESS: 'tb1q9ruq3vlgj79l27euc2wq79wxzae2t86z4adkkv',  // Atlas vault address on testnet4
    OUTPUT_FILE: "UTXOs.xlsx"    // Output filename for UTXOs batch
  }
};

// This script exports deposit records from NEAR to an Excel file.
// It also fetches UTXO records from mempool.space API and exports them to an Excel file.

console.log("⏳ Starting script initialization...");

const { exec } = require("child_process");
const path = require("path");
const ExcelJS = require("exceljs");
const axios = require('axios');

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
 * Fetches deposit records from NEAR using the CLI with pagination.
 */
function fetchDeposits() {
  return new Promise((resolve, reject) => {
    let allDeposits = [];
    let fromIndex = 0;
    const limit = CONFIG.DEPOSITS.BATCH_SIZE;

    const fetchPage = () => {
      exec(
        `near view v2.atlas_public_testnet.testnet get_all_deposits '{"from_index": ${fromIndex}, "limit": ${limit}}'`,
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
    { header: "Timestamp", key: "timestamp", width: 20 },
    { header: "Status", key: "status", width: 10 },
    { header: "Remarks", key: "remarks", width: 100 },
    { header: "Date Created", key: "date_created", width: 20 },
    { header: "Verified Count", key: "verified_count", width: 15 },
    { header: "Yield Provider Gas Fee", key: "yield_provider_gas_fee", width: 20 },
    { header: "Yield Provider Txn Hash", key: "yield_provider_txn_hash", width: 50 },
    { header: "Retry Count", key: "retry_count", width: 15 },
    { header: "Minted Txn Hash Verified Count", key: "minted_txn_hash_verified_count", width: 15 },

    // New simplified Burrow columns
    { header: "Burrow Borrowed Tokens", key: "burrow_borrowed_tokens", width: 50 },
    { header: "Burrow Collateral Tokens", key: "burrow_collateral_tokens", width: 50 },
    
    // Add new column for active order pool IDs
    { header: "Active Order Pool IDs", key: "active_order_pool_ids", width: 100 }
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
      status: deposit.status,
      remarks: deposit.remarks,
      date_created: deposit.date_created,
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
  return new Promise((resolve, reject) => {
    const command = `near view v2.atlas_public_testnet.testnet get_deposit_by_btc_txn_hash '{"btc_txn_hash": "${btcTxnHash}"}'`;
    console.log(`\n🔍 Executing CLI command:\n${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error checking deposit: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`NEAR CLI stderr: ${stderr}`);
      }
      
      const output = stdout.trim();
      console.log(`📄 Raw CLI output:\n${output}`);
      
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
 * Process UTXOs and export to Excel in a single pass
 */
async function processAndExportUTXOs(utxos) {
  console.log("\n🔍 Processing and exporting UTXOs...");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("UTXOs");
  const totalUTXOs = utxos.length;
  
  // Define columns
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
          processingStatus = 'Processing initiated';
        } catch (error) {
          console.error(`❌ [${i + 1}/${totalUTXOs}] Failed to process deposit for ${utxo.txid}: ${error.message}`);
          processingStatus = `Processing failed: ${error.message}`;
        }
      } else {
        console.log(`ℹ️ [${i + 1}/${totalUTXOs}] Deposit already exists for ${utxo.txid}, skipping processing`);
        processingStatus = 'Deposit already exists';
      }
    } catch (error) {
      console.error(`❌ [${i + 1}/${totalUTXOs}] Error processing UTXO ${utxo.txid}:`, error);
      processingStatus = `Error: ${error.message}`;
    }
    
    // Add row to Excel only after all processing is complete
    worksheet.addRow({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      confirmed: utxo.status.confirmed,
      block_height: utxo.status.block_height,
      block_hash: utxo.status.block_hash,
      block_time: utxo.status.block_time,
      deposit_exists: depositExists ? 'Yes' : 'No',
      processing_status: processingStatus
    });
  }
  
  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  
  // Save the Excel file
  const filePath = path.join(__dirname, CONFIG.UTXOS.OUTPUT_FILE);
  await workbook.xlsx.writeFile(filePath);
  console.log(`\n✅ Successfully processed and exported ${utxos.length} UTXO records to ${filePath}`);
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
  try {
    // Create custom axios instance that ignores SSL certificate errors
    const instance = axios.create({
      httpsAgent: new (require('https').Agent)({  
        rejectUnauthorized: false
      })
    });

    const response = await instance.get(`https://test-api.burrow.finance/get_account/${accountId}`, {
      timeout: 5000 // 5 second timeout
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
  return new Promise((resolve, reject) => {
    const command = `near view ref-finance-101.testnet get_pool_shares '{"account_id": "${accountId}", "pool_id": ${poolId}}'`;
    //console.log(`\n🔍 Executing CLI command for ${accountId} pool ${poolId}:\n${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error checking LP shares for ${accountId} pool ${poolId}: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`NEAR CLI stderr for ${accountId}: ${stderr}`);
      }
      
      const output = stdout.trim();
      //console.log(`📄 Raw CLI output for ${accountId} pool ${poolId}:\n${output}`);
      
      try {
        // Get the last line which contains the actual value
        const lines = output.split('\n');
        const lastLine = lines[lines.length - 1].trim();
        
        // Remove any quotes and convert to number
        const valueStr = lastLine.replace(/['"]/g, '');
        const shares = Number(valueStr);
        
        //console.log(`📊 LP shares for ${accountId} pool ${poolId}: ${shares} (type: ${typeof shares})`);
        
        // Return the pool ID value if shares exist and are greater than 0
        if (!isNaN(shares) && shares > 0) {
          //console.log(`📊 Found shares in pool ${poolId}`);
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
    console.log(`📄 Reading file from ${filePath}`);
    await workbook.xlsx.readFile(filePath);
    
    // Get the first worksheet (either by index 1 or by getting the first worksheet)
    const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("Worksheet not found in deposits-quest2.xlsx");
    }
    
    // Log worksheet details for debugging
    console.log(`📊 Found worksheet: "${worksheet.name}" with ${worksheet.rowCount} rows`);
    
    // Verify headers
    const expectedHeaders = ['Receiving Address', 'Burrow Borrowed Tokens', 'Burrow Collateral Tokens', 'ATBTC/WBTC LP Pool IDs'];
    const actualHeaders = worksheet.getRow(1).values.slice(1); // slice(1) to skip empty first cell
    
    if (!expectedHeaders.every((header, index) => header === actualHeaders[index])) {
      throw new Error("Excel file headers do not match expected format");
    }
    
    const totalRows = worksheet.rowCount;
    console.log(`Found ${totalRows - 1} records to process`);
    
    const POOL_IDS = [2482, 2483, 2492];
    
    // Process each row (skip header row)
    for (let rowNumber = 2; rowNumber <= totalRows; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const receivingAddress = row.getCell(1).text;
      
      console.log(`\n📝 Processing row [${rowNumber - 1}/${totalRows - 1}] for address: ${receivingAddress}`);
      
      let wasUpdated = false;
      
      // Only fetch Burrow data if borrowed tokens cell is empty OR doesn't contain expected tokens
      if (receivingAddress) {
        const existingBorrowedTokens = row.getCell(2).text.toLowerCase();
        const existingCollateralTokens = row.getCell(3).text.toLowerCase();
        
        // Skip if both expected tokens are found
        const hasExpectedTokens = existingBorrowedTokens.includes('usdc') && 
                                existingCollateralTokens.includes('atbtc_v2');
        
        if (!hasExpectedTokens) {
          console.log(`⏳ Fetching Burrow data for ${receivingAddress}...`);
          try {
            const burrowData = await fetchBurrowAccountData(receivingAddress);
            
            if (burrowData && burrowData.data) {
              // Update borrowed tokens
              const borrowedTokens = burrowData.data.borrowed?.map(b => b.token_id).join(', ') || '';
              row.getCell(2).value = borrowedTokens;
              
              // Update collateral tokens
              const collateralTokens = burrowData.data.collateral?.map(c => c.token_id).join(', ') || '';
              row.getCell(3).value = collateralTokens;
              
              console.log(`✅ Updated Burrow data for ${receivingAddress}`);
              wasUpdated = true;
            }
          } catch (error) {
            console.error(`❌ Error fetching Burrow data: ${error.message}`);
          }
        } else {
          console.log(`ℹ️ Skipping Burrow fetch for ${receivingAddress} - already has expected tokens`);
        }
      }
      
      // Check LP shares for all pool IDs
      if (receivingAddress) {
        const existingLPShares = row.getCell(4).text;
        
        // Skip if 'true' is already found in the cell
        if (existingLPShares.includes('true')) {
          console.log(`ℹ️ Skipping LP shares check for ${receivingAddress} - already has shares`);
        } else {
          console.log(`⏳ Checking LP shares for ${receivingAddress} across ${POOL_IDS.length} pools...`);
          try {
            const lpResults = await Promise.all(POOL_IDS.map(poolId => checkLPShares(receivingAddress, poolId)));
            
            // Filter out empty results and add ": true" to each pool ID
            const validResults = lpResults.filter(result => result !== '')
              .map(poolId => `${poolId}: true`);
            const newValue = validResults.join(', ');
            
            if (newValue) {
              row.getCell(4).value = newValue;
              console.log(`✅ Updated LP shares status for ${receivingAddress}: ${newValue}`);
              wasUpdated = true;
            } else {
              console.log(`ℹ️ No LP shares found for ${receivingAddress}`);
            }
          } catch (error) {
            console.error(`❌ Error checking LP shares: ${error.message}`);
          }
        }
      }
      
      // Commit the row and save file if any updates were made
      if (wasUpdated) {
        await row.commit();
        await workbook.xlsx.writeFile(filePath);
        console.log(`💾 Committed and saved updates for ${receivingAddress}`);
      } else {
        console.log(`ℹ️ No updates needed for ${receivingAddress}`);
      }
    }
    
    console.log(`\n✅ Successfully processed and updated deposits-quest2.xlsx`);
    
  } catch (error) {
    console.error("❌ Error processing deposits-quest2.xlsx:", error);
    throw error;
  }
}

/**
 * Main function to execute the process.
 */
async function main() {
  console.log("🚀 Main process starting...");
  try {
    if (CONFIG.GENERATE_DEPOSITS_XLSX) {
      console.log("⏳ Fetching deposit records from NEAR...");
      console.log(`ℹ️ Processing ${CONFIG.DEPOSITS.MAX_RECORDS === null ? 'all' : CONFIG.DEPOSITS.MAX_RECORDS} records`);
      const deposits = await fetchDeposits();
      console.log(`✅ Retrieved ${deposits.length} deposit records.`);

      console.log("⏳ Exporting to Excel...");
      await exportToExcel(deposits);
    } else {
      console.log("ℹ️ Skipping deposits.xlsx generation (disabled in CONFIG)");
    }
    
    if (CONFIG.GENERATE_DEPOSITS_QUEST2_XLSX) {
      console.log("⏳ Starting deposits-quest2.xlsx processing...");
      await processDepositsQuest2();
    } else {
      console.log("ℹ️ Skipping deposits-quest2.xlsx processing (disabled in CONFIG)");
    }
    
    if (CONFIG.GENERATE_UTXOS_XLSX) {
      console.log("⏳ Starting UTXO export process...");
      await fetchAndExportUTXOs();
    } else {
      console.log("ℹ️ Skipping UTXOs.xlsx generation (disabled in CONFIG)");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main();
