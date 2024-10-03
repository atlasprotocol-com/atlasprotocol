const REDEMPTION_KEY = "atlas-protocol-redemption";

// Get the local storage key for delegations
export const getRedemptionHistoriesLocalStorageKey  = (pk: string) => {
  return pk ? `${REDEMPTION_KEY}-${pk}` : "";
};
