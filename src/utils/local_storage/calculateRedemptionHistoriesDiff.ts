import { Redemptions } from "@/app/types/redemptions";

import { filterRedemptionHistoriesLocalStorage } from "./filterRedemptionHistoriesLocalStorage";

export const calculateRedemptionHistoriesDiff = async (
  redemptionHistories: Redemptions[],
  redemptionHistoriesLocalStorage: Redemptions[],
): Promise<{ areRedemptionHistoriesDifferent: boolean; redemptionHistories: Redemptions[] }> => {
  // Filter the redemptionHistories that are still valid
  const validRedemptionHistoriesLocalStorage = await filterRedemptionHistoriesLocalStorage(
    redemptionHistoriesLocalStorage,
    redemptionHistories,
  );

  // Extract the txnHash
  const validRedemptionHistoriesHashes = validRedemptionHistoriesLocalStorage
    .map((redemption: Redemptions) => redemption.txnHash)
    .sort();
  const redemptionHistoriesLocalStorageHashes = redemptionHistoriesLocalStorage
    .map((redemption: Redemptions) => redemption.txnHash)
    .sort();

  // Check if the validRedemptionHistories are different from the current redemptionHistoriesLocalStorage
  const areRedemptionHistoriesDifferent =
    validRedemptionHistoriesHashes.length !== redemptionHistoriesLocalStorageHashes.length ||
    validRedemptionHistoriesHashes.some(
      (hash: any, index: any) => hash !== redemptionHistoriesLocalStorageHashes[index],
    );

  return {
    areRedemptionHistoriesDifferent,
    redemptionHistories: validRedemptionHistoriesLocalStorage,
  };
};
