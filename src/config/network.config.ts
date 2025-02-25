import { Network } from "@/utils/wallet/wallet_provider";

export const network =
  (process.env.NEXT_PUBLIC_NETWORK as Network) || Network.SIGNET;

interface NetworkConfig {
  coinName: string;
  coinSymbol: string;
  networkName: string;
  mempoolApiUrl: string;
  network: Network;
}

const mainnetConfig: NetworkConfig = {
  coinName: "BTC",
  coinSymbol: "BTC",
  networkName: "BTC",
  mempoolApiUrl: `${process.env.NEXT_PUBLIC_MEMPOOL_API}`,
  network: Network.MAINNET,
};

const signetConfig: NetworkConfig = {
  coinName: "sBTC",
  coinSymbol: "sBTC",
  networkName: "BTC signet",
  mempoolApiUrl: `${process.env.NEXT_PUBLIC_MEMPOOL_API}/signet`,
  network: Network.SIGNET,
};

const testnetConfig: NetworkConfig = {
  coinName: "Testnet BTC",
  coinSymbol: "tBTC",
  networkName: "BTC testnet",
  mempoolApiUrl: `${process.env.NEXT_PUBLIC_MEMPOOL_API}/testnet`,
  network: Network.TESTNET,
};

const testnet4Config: NetworkConfig = {
  coinName: "Testnet4 BTC",
  coinSymbol: "tBTC4",
  networkName: "BTC testnet4",
  mempoolApiUrl: `${process.env.NEXT_PUBLIC_MEMPOOL_API}/testnet4`,
  network: Network.TESTNET4,
};

const config: Record<string, NetworkConfig> = {
  mainnet: mainnetConfig,
  signet: signetConfig,
  testnet: testnetConfig,
  testnet4: testnet4Config,
};

export function getNetworkConfig(): NetworkConfig {
  switch (network) {
    case Network.MAINNET:
      return config.mainnet;
    case Network.SIGNET:
      return config.signet;
    case Network.TESTNET:
      return config.testnet;
    case Network.TESTNET4:
      return config.testnet4;
    default:
      return config.testnet4;
  }
}

export function validateAddress(network: Network, address: string): void {
  if (network === Network.MAINNET && !address.startsWith("bc1")) {
    throw new Error(
      "Incorrect address prefix for Mainnet. Expected address to start with 'bc1'.",
    );
  } else if (
    [Network.SIGNET, Network.TESTNET, Network.TESTNET4].includes(network) &&
    !address.startsWith("tb1")
  ) {
    throw new Error(
      "Incorrect address prefix for Testnet / Signet. Expected address to start with 'tb1'.",
    );
  } else if (
    ![Network.MAINNET, Network.SIGNET, Network.TESTNET, Network.TESTNET4].includes(network)
  ) {
    throw new Error(
      `Unsupported network: ${network}. Please provide a valid network.`,
    );
  }
}
