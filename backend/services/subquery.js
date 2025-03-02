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
if (!configs.arbitrum.uri) throw new Error("Missing SUBQUERY_ARBITRUM_URI");
if (!configs.optimism.uri) throw new Error("Missing SUBQUERY_OPTIMISM_URI");
if (!configs.near.uri) throw new Error("Missing SUBQUERY_NEAR_URI");

async function request({ network, query, variables, returningKey }) {
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

async function getBurnRedeemEntity(network, transactions) {
  const query = `
  query getBurnRedeemEntity($transactions: [String!]) {
    burnRedeemEntities(filter: {btcTxnHash: {in: $transactions}}) {
      nodes {
        id
        accountAddress
        btcAmount
        timestamp
      }
    }
  }`;
  const variables = { transactions };
  const returningKey = "data.burnRedeemEntities.nodes";

  return request({ network, query, variables, returningKey });
}

async function getMintBridgeEntity(network, transactions) {
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

async function getBurnBridgeEntity(network, transactions) {
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
  if (rpcUrl.includes("arbitrum")) return "arbitrum";
  if (rpcUrl.includes("optimism")) return "optimism";
  if (rpcUrl.includes("near")) return "near";
  return "";
}

module.exports = {
  getMintDepositEntities,
  getBurnRedeemEntity,
  getMintBridgeEntity,
  getBurnBridgeEntity,
  detectNetwork,
};
