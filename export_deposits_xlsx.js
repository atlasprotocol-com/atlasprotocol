const { exec } = require("child_process");
const fs = require("fs");
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
    const limit = 500; // Fetch 500 records at a time

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

            //console.log(records);
            console.log(`Parsed ${records.length} records from index ${fromIndex}`);
            
            if (records.length === 0) {
              return resolve(allDeposits); // No more records
            }
            allDeposits = allDeposits.concat(records);
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
  
  // Define columns for all fields.
  worksheet.columns = [
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
  ];
  
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
      status: deposit.status,
      remarks: deposit.remarks,
      date_created: deposit.date_created,
      verified_count: deposit.verified_count,
      yield_provider_gas_fee: deposit.yield_provider_gas_fee,
      yield_provider_txn_hash: deposit.yield_provider_txn_hash,
      retry_count: deposit.retry_count,
      minted_txn_hash_verified_count: deposit.minted_txn_hash_verified_count,
    });
  });
  
  const filePath = path.join(__dirname, "deposits.xlsx");
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Successfully exported ${deposits.length} deposit records to ${filePath}`);
}

/**
 * Fetches UTXO data from mempool.space API
 */
async function fetchUTXOs() {
  try {
    const response = await axios.get('https://mempool.space/testnet4/api/address/tb1q9ruq3vlgj79l27euc2wq79wxzae2t86z4adkkv/utxo');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch UTXOs:', error);
    throw error;
  }
}

/**
 * Exports UTXO records to an Excel file using ExcelJS
 */
async function exportUTXOsToExcel(utxos) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("UTXOs");
  
  // Define columns
  worksheet.columns = [
    { header: "Transaction ID", key: "txid", width: 70 },
    { header: "Output Index", key: "vout", width: 15 },
    { header: "Value (satoshis)", key: "value", width: 20 },
    { header: "Confirmed", key: "confirmed", width: 15 },
    { header: "Block Height", key: "block_height", width: 15 },
    { header: "Block Hash", key: "block_hash", width: 70 },
    { header: "Block Time", key: "block_time", width: 20 },
  ];
  
  // Add data rows
  utxos.forEach(utxo => {
    worksheet.addRow({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      confirmed: utxo.status.confirmed,
      block_height: utxo.status.block_height,
      block_hash: utxo.status.block_hash,
      block_time: utxo.status.block_time,
    });
  });
  
  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  
  const filePath = path.join(__dirname, "UTXOs.xlsx");
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Successfully exported ${utxos.length} UTXO records to ${filePath}`);
}

/**
 * Main function to fetch and export UTXOs
 */
async function fetchAndExportUTXOs() {
  try {
    console.log("⏳ Fetching UTXO records from mempool.space...");
    const utxos = await fetchUTXOs();
    console.log(`✅ Retrieved ${utxos.length} UTXO records.`);
    
    console.log("⏳ Exporting UTXOs to Excel...");
    await exportUTXOsToExcel(utxos);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

/**
 * Main function to execute the process.
 */
async function main() {
  try {
    // Existing deposits export
    console.log("⏳ Fetching deposit records from NEAR...");
    const deposits = await fetchDeposits();
    console.log(`✅ Retrieved ${deposits.length} deposit records.`);
    
    console.log("⏳ Exporting deposits to Excel...");
    await exportToExcel(deposits);

    // New UTXO export
    //await fetchAndExportUTXOs();

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main();
