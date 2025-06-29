const PostgresClient = require('../db/PostgresClient');

/**
 * Mark an event as processed in the atbtc_events table.
 * @param {string} chain_id
 * @param {string} transaction_hash
 */
async function markEventProcessed(chain_id, transaction_hash) {
  const db = new PostgresClient();
  try {
    await db.query(
      'UPDATE atbtc_events SET processed = 1 WHERE chain_id = $1 AND transaction_hash = $2',
      [chain_id, transaction_hash]
    );
  } finally {
    await db.disconnect();
  }
}

/**
 * Retrieve all unprocessed events from the atbtc_events table.
 * @returns {Promise<Array>}
 */
async function getUnprocessedEvents() {
  const db = new PostgresClient();
  try {
    const res = await db.query('SELECT * FROM atbtc_events WHERE processed = 0');
    return res.rows;
  } finally {
    await db.disconnect();
  }
}

/**
 * Retrieve all unprocessed events from the atbtc_events table.
 * @returns {Promise<Array>}
 */
async function getUnprocessedEventsByNetworkType(networkType) {
  const db = new PostgresClient();
  try {
    const res = await db.query('SELECT * FROM atbtc_events WHERE processed = 0 AND network_type = $1', [networkType]);
    return res.rows;
  } finally {
    await db.disconnect();
  }
}

/**
 * Insert a NEAR event into atbtc_events table.
 * @param {Object} event - The NEAR event object.
 */
async function insertNearEventToAtbtcEvents(event) {
  const db = new PostgresClient();

  try {
    await db.query(
      `INSERT INTO atbtc_events (
        chain_id, block_number, block_hash, transaction_hash, data, address, topics, block_timestamp, processed, origin_txn_hash_minted, network_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (chain_id, transaction_hash) DO NOTHING`,
      [
        event.chainID,
        event.blockNumber,
        null, // block_hash not present
        event.transactionHash,
        event.returnValues,
        event.address,
        event.type, // topics not present
        event.timestamp,
        0, // processed
        '', // origin_txn_hash_minted
        event.networkType
      ]
    );
  } finally {
    await db.disconnect();
  }
}

async function isOriginTxnHashMinted(originTxnHash) {
  const db = new PostgresClient();
  try {
    const res = await db.query(
      'SELECT 1 FROM atbtc_events WHERE origin_txn_hash_minted = $1 LIMIT 1',
      [originTxnHash]
    );
    return res.rowCount > 0;
  } finally {
    await db.disconnect();
  }
}

async function updateOriginTxnHashMinted(originTxnHash, transactionHash) {
  const db = new PostgresClient();
  try {
    await db.query(
      'UPDATE atbtc_events SET origin_txn_hash_minted = $1 WHERE transaction_hash = $2',
      [originTxnHash, transactionHash]
    );
  } finally {
    await db.disconnect();
  }
}

async function getTxnHashByOriginTxnHashMinted(btcTxnHash) {
  const db = new PostgresClient();
  try {
    const res = await db.query('SELECT transaction_hash FROM atbtc_events WHERE origin_txn_hash_minted = $1 LIMIT 1', [btcTxnHash]);
    return res.rowCount > 0 ? res.rows[0].transaction_hash : null;
  } finally {
    await db.disconnect();
  }
}

module.exports = {
  markEventProcessed,
  getUnprocessedEvents,
  insertNearEventToAtbtcEvents,
  getUnprocessedEventsByNetworkType,
  isOriginTxnHashMinted,
  updateOriginTxnHashMinted,
  getTxnHashByOriginTxnHashMinted
}; 