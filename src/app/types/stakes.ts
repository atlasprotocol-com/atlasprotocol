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
  BTC_PENDING_DEPOSIT_INTO_BABYLON = 11,
  BTC_DEPOSITED_INTO_BABYLON = 20,
  BTC_PENDING_MINTED_INTO_ABTC = 21,
  BTC_MINTED_INTO_ABTC = 30,
}

export const Constants = {
  DepositStatus,
};

export function getStatusMessage(status: any): string {
  switch (status) {
    case DepositStatus.BTC_PENDING_DEPOSIT_MEMPOOL:
      return "Pending BTC deposit";
    case DepositStatus.BTC_DEPOSITED_INTO_ATLAS:
      return "Pending aBTC minting";
    case DepositStatus.BTC_PENDING_DEPOSIT_INTO_BABYLON:
      return "Depositing into Babylon";
    case DepositStatus.BTC_DEPOSITED_INTO_BABYLON:
      return "Deposited into Babylon";
    case DepositStatus.BTC_PENDING_MINTED_INTO_ABTC:
      return "Minting aBTC";
    case DepositStatus.BTC_MINTED_INTO_ABTC:
      return "aBTC minted";
    // Add cases for RedemptionStatus when defined
    default:
      return "Unknown status";
  }
}
