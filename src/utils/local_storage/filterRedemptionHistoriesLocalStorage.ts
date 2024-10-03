import { Redemptions } from "@/app/types/redemptions";

// Filter redemptionHistories from the local storage
// Returns the redemptionHistories that are valid and should be kept in the local storage
export const filterRedemptionHistoriesLocalStorage = async (
  redemptionHistoriesLocalStorage: Redemptions[],
  redemptionHistoriesFromAPI: Redemptions[],
): Promise<Redemptions[]> => {
  const validRedemptionHistories: Redemptions[] = [];

  // `continue` will not add the stake to the validRedemptionHistories array
  for (const localStake of redemptionHistoriesLocalStorage) {
    // Check if the stake is already present in the API
    const redemptionInAPI = redemptionHistoriesFromAPI.find(
      (redemption) =>
        redemption?.txnHash === localStake?.txnHash,
    );

    if (redemptionInAPI) {
      continue;
    }

    validRedemptionHistories.push(localStake);
  }

  return validRedemptionHistories;
};
