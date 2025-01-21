"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ReactQueryStreamedHydration } from "@tanstack/react-query-next-experimental";
import { ThemeProvider } from "next-themes";
import React, { useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/config/wagmi";
import { EvmWalletProvider } from "@/utils/evm_wallet/wallet_provider"; // Import EvmWalletProvider
import { NearContext, Wallet } from "@/utils/near";

import { FeedbackRenderer } from "./components/FeedbackRenderer";
import { ErrorProvider } from "./context/Error/ErrorContext";
import { TermsProvider } from "./context/Terms/TermsContext";

const wallet = new Wallet({ networkId: "testnet" });

function Providers({ children }: React.PropsWithChildren) {
  const [signedAccountId, setSignedAccountId] = useState("");

  useEffect(() => {
    wallet.startUp(setSignedAccountId);
  }, []);

  const [client] = React.useState(new QueryClient());

  return (
    <NearContext.Provider value={{ wallet, signedAccountId }}>
      <WagmiProvider config={wagmiConfig}>
        <ThemeProvider defaultTheme="light" attribute="data-theme">
          <QueryClientProvider client={client}>
            <TermsProvider>
              <ErrorProvider>
                <EvmWalletProvider>
                  <ReactQueryStreamedHydration>
                    {children}
                    <FeedbackRenderer />
                  </ReactQueryStreamedHydration>
                </EvmWalletProvider>
              </ErrorProvider>
            </TermsProvider>
            <ReactQueryDevtools
              buttonPosition="bottom-left"
              initialIsOpen={false}
            />
          </QueryClientProvider>
        </ThemeProvider>
      </WagmiProvider>
    </NearContext.Provider>
  );
}

export default Providers;
