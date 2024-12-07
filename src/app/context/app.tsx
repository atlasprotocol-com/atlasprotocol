import { createContext } from "react";

export interface AppContextState {
  nonce?: string;
}

export const AppContext = createContext<AppContextState | undefined>(undefined);
