// src/types/chainConfig.ts
export interface ChainConfig {
  chainID: string;
  networkType: string;
  networkName: string;
  chainRpcUrl: string;
  explorerURL: string;
  aBTCAddress: string;
  nativeCurrency: {
    name: string;
    decimals: number;
    symbol: string;
  };
  firstBlock: number;
  batchSize: number;
  gasLimit: number;
  abiPath: string;
}
