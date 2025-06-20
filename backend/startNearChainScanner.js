const dotenv = require("dotenv");

const { nearChainScanner } = require('./utils/nearChainScanner');
const { Near } = require("./services/near");
const { fetchAndSetChainConfigs } = require("./utils/network.chain.config");
const { fetchAndSetConstants } = require("./constants");
const { updateGlobalParams } = require("./config/globalParams");

const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envFile });

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
    await updateGlobalParams(near);
    // Fetch and set chain configs before running the batch processes
    await fetchAndSetChainConfigs(near);
    await fetchAndSetConstants(near); // Load constants
    console.log("Running near chain scanner");
    while (true) {
        await nearChainScanner(near);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

main().then(() => setTimeout(process.exit.bind(process, 0), 1000));