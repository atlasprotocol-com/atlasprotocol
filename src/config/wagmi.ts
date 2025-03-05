import { createConfig, http } from "wagmi";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  mainnet,
  optimism,
  optimismSepolia,
  Chain
} from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";
import { defineChain } from "viem";

import customChains from "./wagmi_custom_chains.json";

// Convert JSON chain definitions to viem chain objects
const customChainObjects = Object.entries(customChains).map(([_, chainData]) => 
  defineChain(chainData as Chain)
);

// Combine built-in chains with custom chains
const allChains = [
  mainnet,
  optimism,
  optimismSepolia,
  arbitrum,
  arbitrumSepolia,
  base,
  ...customChainObjects
] as const;

export const wagmiConfig = createConfig({
  chains: allChains,
  connectors: [
    injected(),
    metaMask({
      dappMetadata: {
        name: "Atlas Protocol",
      },
    }),
    // safe(),
  ],
  transports: Object.fromEntries(
    allChains.map(chain => [chain.id, http()])
  ),
});