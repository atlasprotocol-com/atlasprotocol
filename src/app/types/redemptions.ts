import { ATLAS_BTC_TOKEN } from "../context/app";

export interface Redemptions {
  txnHash: string;
  abtcRedemptionAddress: string;
  abtcRedemptionChainId: string;
  btcReceivingAddress: string;
  abtcAmount: number;
  timestamp: string;
  status: number;
  remarks: string;
  btcTxnHash: string;
  protocolFee: number;
  yieldProviderGasFee: number;
  btcRedemptionFee: number;
}

export enum RedemptionStatus {
  // Define the statuses as needed
  ABTC_BURNT = 10,
  BTC_PENDING_YIELD_PROVIDER_UNSTAKE = 11,
  BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING = 12,
  BTC_YIELD_PROVIDER_UNSTAKED = 13,
  BTC_PENDING_YIELD_PROVIDER_WITHDRAW = 14,
  BTC_YIELD_PROVIDER_WITHDRAWING = 15,
  BTC_YIELD_PROVIDER_WITHDRAWN = 16,
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
      return "Pending BTC Redemption";
    case RedemptionStatus.BTC_PENDING_YIELD_PROVIDER_UNSTAKE:
      return "Pending Yield Provider Unstake";
    case RedemptionStatus.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING:
      return "Unstaking from Yield Provider"; 
    case RedemptionStatus.BTC_YIELD_PROVIDER_UNSTAKED:
      return "Yield Provider Unstaked";
    case RedemptionStatus.BTC_PENDING_YIELD_PROVIDER_WITHDRAW:
      return "Pending Yield Provider Withdrawal";
    case RedemptionStatus.BTC_YIELD_PROVIDER_WITHDRAWING:
      return "Withdrawing from Yield Provider";
    case RedemptionStatus.BTC_YIELD_PROVIDER_WITHDRAWN:
      return "Withdrawn from Yield Provider";
    case RedemptionStatus.BTC_REDEEMED_BACK_TO_USER:
      return "Successfully Redeemed";
    case RedemptionStatus.BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER:
      return `Sending BTC back to user`;
    case RedemptionStatus.BTC_PENDING_MEMPOOL_CONFIRMATION:
      return `Pending Mempool Confirmation`;
    default:
      return "Unknown Status";
  }
}
