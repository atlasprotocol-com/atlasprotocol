import { encode } from "url-safe-base64";

import { Pagination } from "../types/api";
import { Stakes } from "../types/stakes";

import { apiWrapper } from "./apiWrapper";

export interface PaginatedStakingHistories {
  stakingHistories: Stakes[];
  pagination: Pagination;
}

interface StakingHistoriesAPIResponse {
  data: StakingAPI[];
  pagination: Pagination;
}

interface StakingAPI {
  btc_txn_hash: string;
  btc_sender_address: string;
  receiving_chain_id: string;
  receiving_address: string;
  btc_amount: number;
  minted_txn_hash: string;
  timestamp: string;
  status: number;
  remarks: string;
  yield_provider_gas_fee: number
  protocol_fee: number
  minting_fee: number
}

export const getStakingHistories = async (
  key: string,
  btcWalletAddress?: string,
): Promise<PaginatedStakingHistories> => {
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
    "/api/v1/staker/stakingHistories",
    "Error getting staking histories",
    params,
  );
  // console.log(response);
  const stakingHistoriesAPIResponse: StakingHistoriesAPIResponse =
    response.data;

  const stakingHistories: Stakes[] = stakingHistoriesAPIResponse.data.map(
    (apiStaking: StakingAPI): Stakes => ({
      btcTxnHash: apiStaking.btc_txn_hash,
      btcSenderAddress: apiStaking.btc_sender_address,
      receivingChainId: apiStaking.receiving_chain_id,
      receivingAddress: apiStaking.receiving_address,
      btcAmount: apiStaking.btc_amount,
      minted_txn_hash: apiStaking.minted_txn_hash,
      timestamp: apiStaking.timestamp,
      status: apiStaking.status,
      remarks: apiStaking.remarks,
      yieldProviderGasFee: apiStaking.yield_provider_gas_fee,
      protocolFee: apiStaking.protocol_fee,
      mintingFee: apiStaking.minting_fee,
    }),
  );

  const pagination: Pagination = {
    next_key: stakingHistoriesAPIResponse.pagination.next_key,
  };
  return { stakingHistories: stakingHistories, pagination };
};
