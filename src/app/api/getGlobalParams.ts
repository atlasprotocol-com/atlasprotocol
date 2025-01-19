import { AxiosResponse } from "axios";

import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";

import { GlobalParamsVersion } from "../types/globalParams";

import { apiWrapper } from "./apiWrapper";

interface GlobalParamsDataResponse {
  versions: {
    staking_cap: number;
    max_staking_amount: number;
    min_staking_amount: number;
    atlas_address: string;
  }[];
}

export const getGlobalParams = async (): Promise<GlobalParamsVersion[]> => {
  const { data } = (await apiWrapper(
    "GET",
    "/api/v1/global-params",
    "Error getting global params",
  )) as AxiosResponse<{ data: GlobalParamsDataResponse }>;
  const { versions } = data.data;

  // covert them into GlobalParamsVersion
  return versions.map((v) => ({
    stakingCapSat: v.staking_cap,
    maxStakingAmountSat: v.max_staking_amount,
    minStakingAmountSat: v.min_staking_amount,
    formattedMaxStakingAmount: maxDecimals(
      satoshiToBtc(v.max_staking_amount),
      8,
    ),
    formattedMinStakingAmount: maxDecimals(
      satoshiToBtc(v.min_staking_amount),
      8,
    ),
    atlasAddress: v.atlas_address,
  }));
};
