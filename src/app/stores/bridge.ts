import { WritableDraft } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface BridgeDataStoreState {
  selectedAddress?: string;
  selectedChainId?: string;
}

type Actions = {
  set: (cb: (state: WritableDraft<BridgeDataStoreState>) => void) => void;
};

export const useBridgeStore = create<BridgeDataStoreState & Actions>()(
  immer((setData) => ({
    selectedAddress: "",
    selectedChainId: "",
    set: (cb) => setData(cb),
  })),
);
