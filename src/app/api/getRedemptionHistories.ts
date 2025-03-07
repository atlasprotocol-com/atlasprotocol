import { encode } from "url-safe-base64";

import { Pagination } from "../types/api";
import { Redemptions } from "../types/redemptions";

import { apiWrapper } from "./apiWrapper";

export interface PaginatedRedemptionHistories {
  redemptionHistories: Redemptions[];
  pagination: Pagination;
}

interface RedemptionHistoriesAPIResponse {
  data: RedemptionAPI[];
  pagination: Pagination;
}

interface RedemptionAPI {
  txn_hash: string;
  abtc_redemption_address: string;
  abtc_redemption_chain_id: string;
  btc_receiving_address: string;
  abtc_amount: number; // aBTC amount in satoshis
  timestamp: string;
  status: number;
  remarks: string;
  btc_txn_hash: string;
  protocol_fee: number;
  yield_provider_gas_fee: number;
  btc_redemption_fee: number;
}

export const getRedemptionHistories = async (
  key: string,
  btcWalletAddress?: string,
): Promise<PaginatedRedemptionHistories> => {
  if (!btcWalletAddress) {
    throw new Error("No BTC wallet address provided");
  }

  // const limit = 100;
  // const reverse = false;

  const params = {
    pagination_key: encode(key),
    // "pagination_reverse": reverse,
    // "pagination_limit": limit,
    btc_address: encode(btcWalletAddress),
  };

  const response = await apiWrapper(
    "GET",
    "/api/v1/staker/redemptionHistories",
    "Error getting redemption histories",
    params,
  );
  //console.log(response);
  const redemptionHistoriesAPIResponse: RedemptionHistoriesAPIResponse =
    response.data;

  const redemptionHistories: Redemptions[] =
    redemptionHistoriesAPIResponse.data.map(
      (apiRedemption: RedemptionAPI): Redemptions => ({
        txnHash: apiRedemption.txn_hash,
        abtcRedemptionAddress: apiRedemption.abtc_redemption_address,
        abtcRedemptionChainId: apiRedemption.abtc_redemption_chain_id,
        btcReceivingAddress: apiRedemption.btc_receiving_address,
        abtcAmount: apiRedemption.abtc_amount,
        timestamp: apiRedemption.timestamp,
        status: apiRedemption.status,
        remarks: apiRedemption.remarks,
        btcTxnHash: apiRedemption.btc_txn_hash,
        protocolFee: apiRedemption.protocol_fee,
        yieldProviderGasFee: apiRedemption.yield_provider_gas_fee,
        btcRedemptionFee: apiRedemption.btc_redemption_fee,
      }),
    );

  const pagination: Pagination = {
    next_key: redemptionHistoriesAPIResponse.pagination.next_key,
  };

  return { redemptionHistories: redemptionHistories, pagination };
};
