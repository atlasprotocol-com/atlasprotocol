// lastScannedBlockHelper.js
const fs = require("fs").promises;
const os = require("os");
const path = require("path");
const LAST_SCANNED_BLOCKS_FILE = path.join(__dirname, "lastScannedBlocks.json");

async function loadLastScannedBlocks() {
  try {
    const data = await fs.readFile(LAST_SCANNED_BLOCKS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(
        "No previous scanned block data found. Initializing new file.",
      );
      return {};
    } else {
      throw error;
    }
  }
}

async function saveLastScannedBlocks(lastScannedBlocks) {
  await fs.writeFile(
    LAST_SCANNED_BLOCKS_FILE,
    JSON.stringify(lastScannedBlocks, null, 2),
  );
}

async function getBlockCursor(name, chainId, currentBlock, backfill = 2000) {
  // const filename = ["ATLAS", process.env.PROJECT_NAME, name, chainId]
  const filename = ["ATLAS", process.env.PROJECT_NAME, chainId]
    .filter(Boolean)
    .join("_");
  const BLOCK_CURSOR_FILENAME = path.resolve(os.tmpdir(), filename);

  try {
    const blockCursor = await fs.readFile(BLOCK_CURSOR_FILENAME, "utf8");
    console.log(`${BLOCK_CURSOR_FILENAME} ---> ${blockCursor}`);

    return Number(blockCursor);
  } catch {
    return Number(currentBlock) - backfill;
  }
}

async function setBlockCursor(name, chainId, blockCursor) {
  // const filename = ["ATLAS", process.env.PROJECT_NAME, name, chainId]
  const filename = ["ATLAS", process.env.PROJECT_NAME, chainId]
    .filter(Boolean)
    .join("_");
  const BLOCK_CURSOR_FILENAME = path.resolve(os.tmpdir(), filename);

  try {
    console.log(`${BLOCK_CURSOR_FILENAME} <--- ${blockCursor}`);

    await fs.writeFile(BLOCK_CURSOR_FILENAME, blockCursor.toString());
  } catch (err) {
    console.error(
      `${BLOCK_CURSOR_FILENAME} <--- ${blockCursor} | ${err.message}`,
    );
  }
}

module.exports = {
  loadLastScannedBlocks,
  saveLastScannedBlocks,
  getBlockCursor,
  setBlockCursor,
};
