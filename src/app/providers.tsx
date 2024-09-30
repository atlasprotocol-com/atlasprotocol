"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ReactQueryStreamedHydration } from "@tanstack/react-query-next-experimental";
import { ThemeProvider } from "next-themes";
import React from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/config/wagmi";
import { EvmWalletProvider } from "@/utils/evm_wallet/wallet_provider"; // Import EvmWalletProvider

import { ErrorProvider } from "./context/Error/ErrorContext";
import { TermsProvider } from "./context/Terms/TermsContext";
import { ChainConfigProvider } from "./context/api/ChainConfigProvider";
import { GlobalParamsProvider } from "./context/api/GlobalParamsProvider";
import { StakingStatsProvider } from "./context/api/StakingStatsProvider";
import { BtcHeightProvider } from "./context/mempool/BtcHeightProvider";

function Providers({ children }: React.PropsWithChildren) {
  const [client] = React.useState(new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <ThemeProvider defaultTheme="light" attribute="data-theme">
        <QueryClientProvider client={client}>
          <TermsProvider>
            <ErrorProvider>
              <GlobalParamsProvider>
                <ChainConfigProvider>
                  <BtcHeightProvider>
                    <StakingStatsProvider>
                      <EvmWalletProvider>
                        <ReactQueryStreamedHydration>
                          {children}
                        </ReactQueryStreamedHydration>
                      </EvmWalletProvider>
                    </StakingStatsProvider>
                  </BtcHeightProvider>
                </ChainConfigProvider>
              </GlobalParamsProvider>
            </ErrorProvider>
          </TermsProvider>
          <ReactQueryDevtools
            buttonPosition="bottom-left"
            initialIsOpen={false}
          />
        </QueryClientProvider>
      </ThemeProvider>
    </WagmiProvider>
  );
}

export default Providers;
