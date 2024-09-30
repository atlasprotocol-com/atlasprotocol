import { Stakes } from "@/app/types/stakes";

// Filter stakingHistories from the local storage
// Returns the stakingHistories that are valid and should be kept in the local storage
export const filterStakingHistoriesLocalStorage = async (
  stakingHistoriesLocalStorage: Stakes[],
  stakingHistoriesFromAPI: Stakes[],
): Promise<Stakes[]> => {
  const validStakingHistories: Stakes[] = [];

  // `continue` will not add the stake to the validStakingHistories array
  for (const localStake of stakingHistoriesLocalStorage) {
    // Check if the stake is already present in the API
    const stakeInAPI = stakingHistoriesFromAPI.find(
      (stake) =>
        stake?.btcTxnHash === localStake?.btcTxnHash
    );

    if (stakeInAPI) {
      continue;
    }

    validStakingHistories.push(localStake);
  }

  return validStakingHistories;
};
