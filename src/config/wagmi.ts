import { createConfig, http } from "wagmi";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  mainnet,
  optimism,
  optimismSepolia,
} from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";
import { defineChain } from "viem";

const juChainTestnet = defineChain({
  id: 66633666,
  name: "JuChain Testnet",
  network: "juchain-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "JU",
    symbol: "JU",
  },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.juchain.org"] },
    public: { http: ["https://testnet-rpc.juchain.org"] },
  },
  blockExplorers: {
    default: {
      name: "JuChain Explorer",
      url: "http://explorer-testnet.juchain.org",
    },
  },
});

export const wagmiConfig = createConfig({
  chains: [mainnet, optimism, optimismSepolia, arbitrum, arbitrumSepolia, base, juChainTestnet],
  connectors: [
    injected(),
    metaMask({
      dappMetadata: {
        name: "Atlas Protocol",
      },
    }),
    // safe(),
  ],
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimismSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [juChainTestnet.id]: http(),
  },
});