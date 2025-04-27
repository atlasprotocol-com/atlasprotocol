const axios = require("axios");
const _ = require("lodash");

const configs = {
  arbitrum: {
    uri: process.env.SUBQUERY_ARBITRUM_URI,
  },
  optimism: {
    uri: process.env.SUBQUERY_OPTIMISM_URI,
  },
  near: {
    uri: process.env.SUBQUERY_NEAR_URI,
  },
};

function validate() {
  if (!configs.arbitrum.uri) throw new Error("Missing SUBQUERY_ARBITRUM_URI");
  if (!configs.optimism.uri) throw new Error("Missing SUBQUERY_OPTIMISM_URI");
  if (!configs.near.uri) throw new Error("Missing SUBQUERY_NEAR_URI");
}

async function request({ network, query, variables, returningKey }) {
  validate();

  if (!configs[network]) throw new Error(`Invalid network: ${network}`);
  if (!returningKey) throw new Error(`Missing returning key`);

  const uri = configs[network].uri;
  const response = await axios.post(uri, {
    query,
    variables,
  });

  return _.get(response.data, returningKey);
}

async function getMintDepositEntities(network, transactions) {
  const query = `
  query getMintDepositEntities($transactions: [String!]) {
    mintDepositEntities(filter: {btcTxnHash: {in: $transactions}}) {
      nodes {
        id
        accountAddress
        btcTxnHash
        btcAmount
        timestamp
      }
    }
  }`;
  const variables = { transactions };
  const returningKey = "data.mintDepositEntities.nodes";

  return request({ network, query, variables, returningKey });
}

async function getBurnRedeemEntities(network, transactions) {
  const query = `
  query getBurnRedeemEntity($transactions: [String!]) {
    burnRedeemEntities(filter: {id: {notIn: $transactions}}) {
      nodes {
        id
        accountAddress
        btcAddress
        btcAmount
        timestamp
      }
    }
  }`;
  const variables = { transactions };
  const returningKey = "data.burnRedeemEntities.nodes";

  return request({ network, query, variables, returningKey });
}

async function getMintBridgeEntities(network, transactions) {
  const query = `
  query getMintBridgeEntity($transactions: [String!]) {
    mintBridgeEntities(filter: {btcTxnHash: {in: $transactions}}) {
      nodes {
        id
        accountAddress
        btcAmount
        originChainId
        originChainAddress
        originTxnHash
        timestamp
      }
    }
  }`;
  const variables = { transactions };
  const returningKey = "data.mintBridgeEntities.nodes";

  return request({ network, query, variables, returningKey });
}

async function getBurnBridgeEntities(network, transactions) {
  const query = `
  query getBurnBridgeEntity($transactions: [String!]) {
    burnBridgeEntities(filter: {btcTxnHash: {in: $transactions}}) {
      nodes {
        id
        accountAddress
        btcAmount
        destChainId
        destChainAddress
        mintingFeeSat
        bridgingFeeSat
        timestamp
      }
    }
  }`;
  const variables = { transactions };
  const returningKey = "data.burnBridgeEntities.nodes";

  return request({ network, query, variables, returningKey });
}

function detectNetwork(rpcUrl) {
  if (!rpcUrl) return "";
  if (rpcUrl.includes("arbitrum")) return "arbitrum";
  if (rpcUrl.includes("optimism")) return "optimism";
  if (rpcUrl.includes("near")) return "near";
  return "";
}

function isEnableSubquery() {
  try {
    validate();
    return (process.env.SUBQUERY_ENABLE || "false").toLowerCase() === "true";
  } catch {
    return false;
  }
}

async function getTxsOfNetwork(network) {
  const [mindeposits, burnredeems, mintbridges, burnbridges] =
    await Promise.all([
      (async () => {
        const query = `
      query getMintDepositEntities {
        mintDepositEntities(first: 1000) {
          nodes {
            id
            accountAddress
            btcTxnHash
            btcAmount
            timestamp
          }
        }
      }`;
        const variables = {};
        const returningKey = "data.mintDepositEntities.nodes";

        return request({ network, query, variables, returningKey });
      })(),
      (async () => {
        const query = `
      query getBurnRedeemEntity {
        burnRedeemEntities(first: 1000) {
          nodes {
            id
            accountAddress
            btcAddress
            btcAmount
            timestamp
          }
        }
      }`;
        const variables = {};
        const returningKey = "data.burnRedeemEntities.nodes";

        return request({ network, query, variables, returningKey });
      })(),
      (async () => {
        const query = `
      query getMintBridgeEntity {
        mintBridgeEntities(first: 1000) {
          nodes {
            id
            accountAddress
            btcAmount
            originChainId
            originChainAddress
            originTxnHash
            timestamp
          }
        }
      }`;
        const variables = {};
        const returningKey = "data.mintBridgeEntities.nodes";

        return request({ network, query, variables, returningKey });
      })(),
      (async () => {
        const query = `
      query getBurnBridgeEntity {
        burnBridgeEntities(first: 1000) {
          nodes {
            id
            accountAddress
            btcAmount
            destChainId
            destChainAddress
            mintingFeeSat
            bridgingFeeSat
            timestamp
          }
        }
      }`;
        const variables = {};
        const returningKey = "data.burnBridgeEntities.nodes";

        return request({ network, query, variables, returningKey });
      })(),
    ]);

  return { mindeposits, burnredeems, mintbridges, burnbridges };
}

module.exports = {
  getMintDepositEntities,
  getBurnRedeemEntities,
  getMintBridgeEntities,
  getBurnBridgeEntities,
  detectNetwork,
  isEnableSubquery,
  validate,
  getTxsOfNetwork,
};
