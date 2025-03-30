import { BridgeHistory } from "@/app/types/bridge";

export const filterBridgeHistoriesLocalStorage = async (
  bridgeHistoriesLocalStorage: BridgeHistory[],
  bridgeHistoriesFromAPI: BridgeHistory[],
) => {
  const validBridgeHistories: BridgeHistory[] = [];

  for (const localBridge of bridgeHistoriesLocalStorage) {
    const bridgeInAPI = bridgeHistoriesFromAPI.find(
      (bridge) => bridge?.txn_hash === localBridge?.txn_hash,
    );

    if (bridgeInAPI) {
      continue;
    }

    validBridgeHistories.push(localBridge);
  }

  return validBridgeHistories;
};

export const calculateBridgeHistoriesDiff = async (
  bridgeHistories: BridgeHistory[],
  bridgeHistoriesLocalStorage: BridgeHistory[],
) => {
  // Filter the bridgeHistories that are still valid
  const validBridgeHistoriesLocalStorage =
    await filterBridgeHistoriesLocalStorage(
      bridgeHistoriesLocalStorage,
      bridgeHistories,
    );

  // Extract the txnHash
  const validBridgeHistoriesHashes = validBridgeHistoriesLocalStorage
    .map((bridge: BridgeHistory) => bridge.txn_hash)
    .sort();
  const bridgeHistoriesLocalStorageHashes = bridgeHistoriesLocalStorage
    .map((bridge: BridgeHistory) => bridge.txn_hash)
    .sort();

  // Check if the validBridgeHistories are different from the current bridgeHistoriesLocalStorage
  const areBridgeHistoriesDifferent =
    validBridgeHistoriesHashes.length !==
      bridgeHistoriesLocalStorageHashes.length ||
    validBridgeHistoriesHashes.some(
      (hash: any, index: any) =>
        hash !== bridgeHistoriesLocalStorageHashes[index],
    );

  return {
    areBridgeHistoriesDifferent,
    bridgeHistories: validBridgeHistoriesLocalStorage,
  };
};
