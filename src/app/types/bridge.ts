import { ATLAS_BTC_TOKEN } from "../context/app";

export interface BridgeHistory {
  txn_hash: string;
  origin_chain_id: string;
  origin_chain_address: string;
  dest_chain_id: string;
  dest_chain_address: string;
  dest_txn_hash: string;
  abtc_amount: number;
  timestamp: number;
  status: number;
  remarks: string;
  date_created: number;
  verified_count: number;
  minting_fee_sat: number;
  protocol_fee: number;
  bridging_gas_fee_sat: number;
}

// pub const BRG_ABTC_PENDING_BURNT: u8 = 0;
//     pub const BRG_ABTC_BURNT: u8 = 10;
//     pub const BRG_ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST: u8 = 11;
//     pub const BRG_ABTC_MINTED_TO_DEST: u8 = 20;
export enum BridgeStatus {
  ABTC_PENDING_BURNT = 0,
  ABTC_BURNT = 10,
  ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST = 11,
  ABTC_MINTED_TO_DEST = 20,
}

export function getStatusMessage(status: any): string {
  switch (status) {
    case BridgeStatus.ABTC_PENDING_BURNT:
      return `Pending ${ATLAS_BTC_TOKEN} Burn`;
    case BridgeStatus.ABTC_BURNT:
      return `${ATLAS_BTC_TOKEN} Burnt`;
    case BridgeStatus.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST:
      return `Pending ${ATLAS_BTC_TOKEN} Bridge`;
    case BridgeStatus.ABTC_MINTED_TO_DEST:
      return `${ATLAS_BTC_TOKEN} Minted`;
    default:
      return "Unknown Status";
  }
}
