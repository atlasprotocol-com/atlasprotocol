export interface NearGas {
  SIGN_GAS: string;
  GAS_FOR_STORAGE_DEPOSIT: string;
  GAS_FOR_MINT_CALL: string;
  MIN_STORAGE_DEPOSIT: string;
}

export const NEAR_GAS = {
  SIGN_GAS: "10", // Gas for storage deposit call (in TGas)
  GAS_FOR_STORAGE_DEPOSIT: "10", // Gas for storage deposit call (in TGas)
  GAS_FOR_MINT_CALL: "100", // Gas for minting call (in TGas)
  MIN_STORAGE_DEPOSIT: "1250000000000000000000", // In yoctoNEAR
};
