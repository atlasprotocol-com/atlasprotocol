export interface Redemptions {
  txnHash: string;
  abtcRedemptionAddress: string;
  abtcRedemptionChainId: string;
  btcReceivingAddress: string;
  abtcAmount: number;
  timestamp: string;
  status: string;
  remarks: string;
  btcTxnHash: string;
}

export enum RedemptionStatus {
  // Define the statuses as needed
  ABTC_BURNT = 10,
  BTC_PENDING_REDEMPTION_FROM_BABYLON_TO_ATLAS = 11,
  BTC_REDEEMED_FROM_BABYLON_INTO_ATLAS = 20,
  BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER = 21,
  BTC_PENDING_MEMPOOL_CONFIRMATION = 22,
  BTC_REDEEMED_BACK_TO_USER = 30,
}

export const Constants = {
  RedemptionStatus,
};

export function getStatusMessage(status: any): string {
  switch (status) {
    case RedemptionStatus.ABTC_BURNT:
      return "Pending BTC redemption";
    case RedemptionStatus.BTC_PENDING_REDEMPTION_FROM_BABYLON_TO_ATLAS:
      return "Pending Babylon redemption";
    case RedemptionStatus.BTC_REDEEMED_FROM_BABYLON_INTO_ATLAS:
      return "Sending BTC";
    case RedemptionStatus.BTC_PENDING_MEMPOOL_CONFIRMATION:
      return "Sending BTC pending";
    case RedemptionStatus.BTC_REDEEMED_BACK_TO_USER:
      return "Successfully redeemed";
      case RedemptionStatus.BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER:
      return "Pending aBTC Redemption";
    default:
      return "Unknown status";
  }
}
