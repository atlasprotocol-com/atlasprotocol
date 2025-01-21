import { ATLAS_BTC_TOKEN } from "../context/app";

export interface Stakes {
  btcTxnHash: string;
  btcSenderAddress: string;
  receivingChainId: string;
  receivingAddress: string;
  btcAmount: number;
  minted_txn_hash: string;
  timestamp: string;
  status: string;
  remarks: string;
}

export enum DepositStatus {
  BTC_PENDING_DEPOSIT_MEMPOOL = 0,
  BTC_DEPOSITED_INTO_ATLAS = 10,
  BTC_PENDING_YIELD_PROVIDER_DEPOSIT = 11,
  BTC_YIELD_PROVIDER_DEPOSITED = 20,
  BTC_PENDING_MINTED_INTO_ABTC = 21,
  BTC_MINTED_INTO_ABTC = 30,
}

export const Constants = {
  DepositStatus,
};

export function getStatusMessage(status: any): string {
  switch (status) {
    case DepositStatus.BTC_PENDING_DEPOSIT_MEMPOOL:
      return "Pending BTC Deposit";
    case DepositStatus.BTC_DEPOSITED_INTO_ATLAS:
      return `BTC Deposited into Atlas`;
    case DepositStatus.BTC_PENDING_YIELD_PROVIDER_DEPOSIT:
      return "Depositing into Yield Provider";
    case DepositStatus.BTC_YIELD_PROVIDER_DEPOSITED:
      return "Deposited into Yield Provider";
    case DepositStatus.BTC_PENDING_MINTED_INTO_ABTC:
      return `Minting ${ATLAS_BTC_TOKEN}`;
    case DepositStatus.BTC_MINTED_INTO_ABTC:
      return `${ATLAS_BTC_TOKEN} Minted`;
    // Add cases for RedemptionStatus when defined
    default:
      return "Unknown status";
  }
}
