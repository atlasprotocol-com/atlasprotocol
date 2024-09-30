const STAKING_KEY = "atlas-protocol-staking";

// Get the local storage key for delegations
export const getStakingHistoriesLocalStorageKey = (pk: string) => {
  return pk ? `${STAKING_KEY}-${pk}` : "";
};
