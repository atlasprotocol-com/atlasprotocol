import { StakingStats } from "../types/stakingStats";

import { apiWrapper } from "./apiWrapper";

interface StatsAPIResponse {
  data: StatsAPI;
}

interface StatsAPI {
  btc_staked: number;
  tvl: number;
  atbtc_minted: number;
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
  };
};
