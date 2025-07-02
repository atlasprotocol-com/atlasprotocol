export interface GlobalParamsVersion {
  stakingCapSat: number;
  maxStakingAmountSat: number;
  minStakingAmountSat: number;
  atlasAddress: string;
  formattedMinStakingAmount: number;
  formattedMaxStakingAmount: number;
  feeDepositPercentage: number;
  feeRedemptionPercentage: number;
  feeBridgingPercentage: number;
  treasuryAddress: string;
  evmAtlasAddress: string;
  atbtcMinRedemptionAmount: number;
  atbtcMinBridgingAmount: number;
}
