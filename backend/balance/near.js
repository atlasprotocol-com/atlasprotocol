const dotenv = require("dotenv");
// Load environment variables from .env.local or .env based on NODE_ENV
const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envFile });

const { Near } = require("../services/near");
const {
  fetchAndSetChainConfigs,
  getAllChainConfig,
} = require("../utils/network.chain.config");

const near = new Near(
  process.env.NEAR_NODE_URL,
  process.env.NEAR_NODE_URL_PROVIDER,
  process.env.NEAR_ACCOUNT_ID,
  process.env.NEAR_CONTRACT_ID,
  process.env.NEAR_PRIVATE_KEY,
  process.env.NEAR_NETWORK_ID,
  process.env.NEAR_DEFAULT_GAS,
  process.env.NEAR_MPC_CONTRACT_ID,
  process.env.NEAR_BIT_HIVE_CONTRACT_ID,
);

async function main() {
  await near.init();
  await fetchAndSetChainConfigs(near);
  const conf = getAllChainConfig();
  return { near, conf };
}

module.exports = main;
