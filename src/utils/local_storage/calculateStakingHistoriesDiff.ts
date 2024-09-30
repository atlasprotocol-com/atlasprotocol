import { Stakes } from "@/app/types/stakes";

import { filterStakingHistoriesLocalStorage } from "./filterStakingHistoriesLocalStorage";

export const calculateStakingHistoriesDiff = async (
  stakingHistories: Stakes[],
  stakingHistoriesLocalStorage: Stakes[],
): Promise<{ areStakingHistoriesDifferent: boolean; stakingHistories: Stakes[] }> => {
  // Filter the stakingHistories that are still valid
  const validStakingHistoriesLocalStorage = await filterStakingHistoriesLocalStorage(
    stakingHistoriesLocalStorage,
    stakingHistories,
  );

  // Extract the stakingTxHashHex
  const validStakingHistoriesHashes = validStakingHistoriesLocalStorage
    .map((stake: Stakes) => stake.btcTxnHash)
    .sort();
  const stakingHistoriesLocalStorageHashes = stakingHistoriesLocalStorage
    .map((stake: Stakes) => stake.btcTxnHash)
    .sort();

  // Check if the validStakingHistories are different from the current stakingHistoriesLocalStorage
  const areStakingHistoriesDifferent =
    validStakingHistoriesHashes.length !== stakingHistoriesLocalStorageHashes.length ||
    validStakingHistoriesHashes.some(
      (hash: any, index: any) => hash !== stakingHistoriesLocalStorageHashes[index],
    );

  return {
    areStakingHistoriesDifferent,
    stakingHistories: validStakingHistoriesLocalStorage,
  };
};
