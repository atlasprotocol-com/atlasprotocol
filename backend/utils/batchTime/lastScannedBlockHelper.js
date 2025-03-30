// lastScannedBlockHelper.js
const fs = require("fs").promises;
const path = require("path");
const LAST_SCANNED_BLOCKS_FILE = path.join(
    __dirname,
    "lastScannedBlocks.json",
  );

async function loadLastScannedBlocks() {
  try {
    const data = await fs.readFile(LAST_SCANNED_BLOCKS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("No previous scanned block data found. Initializing new file.");
      return {};
    } else {
      throw error;
    }
  }
}

async function saveLastScannedBlocks(lastScannedBlocks) {
  await fs.writeFile(LAST_SCANNED_BLOCKS_FILE, JSON.stringify(lastScannedBlocks, null, 2));
}

module.exports = { loadLastScannedBlocks, saveLastScannedBlocks };
