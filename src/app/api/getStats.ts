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
    eth_price_btc: number;
    eth_price_usd: number;
    near_price_usd: number;
    near_price_btc: number;
    pol_price_usd: number;
    deposits: {
      count: number;
    };
    redemptions: {
      count: number;
    };
  };
}

export const getStats = async (): Promise<StakingStats> => {
  console.log("getStats");
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
    ethPriceBtc: statsAPI.metadata?.eth_price_btc || 0,
    ethPriceUsd: statsAPI.metadata?.eth_price_usd || 0,
    nearPriceUsd: statsAPI.metadata?.near_price_usd || 0,
    nearPriceBtc: statsAPI.metadata?.near_price_btc || 0,
    polPriceUsd: statsAPI.metadata?.pol_price_usd || 0,
  };
};
