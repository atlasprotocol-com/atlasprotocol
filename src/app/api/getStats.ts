import { StakingStats } from "../types/stakingStats";

import { apiWrapper } from "./apiWrapper";

interface StatsAPIResponse {
  data: StatsAPI;
}

interface StatsAPI {
  btc_staked: number;
  tvl: number;
  atbtc_minted: number;
  metadata: {
    btc_price_usd: number;
    btc_price_eth: number;
    deposits: {
      count: number;
    };
    redemptions: {
      count: number;
    };
  };
}

export const getStats = async (): Promise<StakingStats> => {
  const response = await apiWrapper(
    "GET",
    "/api/v1/stats",
    "Error getting stats",
  );

  const statsAPIResponse: StatsAPIResponse = response.data;
  const statsAPI: StatsAPI = statsAPIResponse.data;

  return {
    btcStaked: statsAPI.btc_staked || 0,
    tvl: statsAPI.tvl || 0,
    atbtcMinted: statsAPI.btc_staked || 0,
    btcPriceUsd: statsAPI.metadata?.btc_price_usd || 0,
    btcPriceEth: statsAPI.metadata?.btc_price_eth || 0,
  };
};
