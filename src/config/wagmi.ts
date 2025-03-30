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

export const wagmiConfig = createConfig({
  chains: [mainnet, optimism, optimismSepolia, arbitrum, arbitrumSepolia, base],
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
  },
});