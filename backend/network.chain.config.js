// network.chain.config.js
const btcSignetConfig = {
  chainID: "Signet",
  networkType: "BTC",
  networkName: "Bitcoin Signet",
  chainRpcUrl: "https://mempool.space/signet/api",
  explorerURL: "https://mempool.space/signet/",
};
const arbSepoliaConfig = {
  chainID: "421614",
  networkType: "EVM",
  networkName: "Arbitrum Sepolia",
  chainRpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
  explorerURL: "https://sepolia.arbiscan.io/",
  aBTCAddress: "0x8d7ad8024cc5d0b5c63e20137d45650ac492eb72", //testnet
  //aBTCAddress: "0xbaaa5a3f2e6b3c98fbdb9b24c6ad4863fef3e21b", //devnet
  nativeCurrency: { name: "ETH", decimals: 18, symbol: "ETH" },
  firstBlock: 67300000, //before we do indexer
  batchSize: 50000, //before we do indexer
  gasLimit: 5000000,
  abiPath: "../../contract/artifacts/aBTC.abi",
};
const opSepoliaConfig = {
  chainID: "11155420",
  networkType: "EVM",
  networkName: "Optimism Sepolia",
  chainRpcUrl: "https://sepolia.optimism.io",
  explorerURL: "https://sepolia-optimism.etherscan.io/",
  aBTCAddress: "0xedfA6658C3B57C05178790B1Da546A3a659A4bC1", //testnet
  //aBTCAddress: "0x16fbcca49d8dbdbebfbb7821cf1dbbd504143b6f", //devnet
  nativeCurrency: { name: "ETH", decimals: 18, symbol: "ETH" },
  firstBlock: 15210000, //before we do indexer
  batchSize: 10000, //before we do indexer
  gasLimit: 5000000,
  abiPath: "../../contract/artifacts/aBTC.abi",
};
const chainConfig = {
  btcSignet: btcSignetConfig,
  arbsepolia: arbSepoliaConfig,
  opsepolia: opSepoliaConfig,
};

function getChainConfig(chainID) {
  for (const key in chainConfig) {
    if (chainConfig[key].chainID === chainID) {
      return chainConfig[key];
    }
  }
  throw new Error(`Chain configuration for chainID ${chainID} not found`);
}

module.exports = {
  chainConfig,
  getChainConfig,
};
