import { encode } from "url-safe-base64";

import { Pagination } from "../types/api";
import { BridgeHistory } from "../types/bridge";

import { apiWrapper } from "./apiWrapper";

export interface PaginatedBridgeHistories {
  bridgeHistory: BridgeHistory[];
  pagination: Pagination;
}

interface BridgeHistoriesAPIResponse {
  data: BridgeHistory[];
  pagination: Pagination;
}

export const getBridgeHistories = async (address: string, key: string) => {
  const params = {
    pagination_key: encode(key),
    chain_address: address,
  };

  const response = await apiWrapper(
    "GET",
    "/api/v1/staker/bridgeHistories",
    "Error getting bridge histories",
    params,
  );

  const bridgeHistoriesAPIResponse: BridgeHistoriesAPIResponse = response.data;

  const pagination: Pagination = {
    next_key: bridgeHistoriesAPIResponse.pagination.next_key,
  };
  return { bridgeHistories: bridgeHistoriesAPIResponse.data, pagination };
};
