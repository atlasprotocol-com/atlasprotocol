import { Network } from "bitcoinjs-lib";
import React from "react";

import { WalletProvider } from "@/utils/wallet/wallet_provider";

export interface AppContextType {
  BTC_TOKEN: string;
  ATLAS_BTC_TOKEN: string;
  btcWallet: WalletProvider | undefined;
  btcAddress: string | undefined;
  btcPublicKeyNoCoord: string | undefined;
  btcNetwork: Network | undefined;
  btcRefreshBalance: () => void;
}

export const ATLAS_BTC_TOKEN = "atBTC";

export const defaultAppContext: AppContextType = {
  BTC_TOKEN: "tBTC",
  ATLAS_BTC_TOKEN: ATLAS_BTC_TOKEN,
  btcWallet: undefined,
  btcAddress: undefined,
  btcPublicKeyNoCoord: undefined,
  btcNetwork: undefined,
  btcRefreshBalance: () => {},
};

export const AppContext =
  React.createContext<AppContextType>(defaultAppContext);

export function useAppContext() {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within a AppProvider");
  }
  return context;
}
