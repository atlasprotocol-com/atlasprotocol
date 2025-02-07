import { apiWrapper } from "./apiWrapper";

interface RedemptionFeesAPIResponse {
  data: RedemptionFeesAPI;
}

interface RedemptionFeesAPI {
  estimatedGasFee: number;
  atlasProtocolFee: number;
  estimatedFeeRate: number;
}

interface RedemptionFees {
  estimatedGasFee: number;
  atlasProtocolFee: number;
  estimatedFeeRate: number;
}

export const getRedemptionFees = async (
  amount: number,
): Promise<RedemptionFees> => {
  try {
    const params = {
      amount: amount,
    };

    const response = await apiWrapper(
      "GET",
      "/api/v1/atlas/redemptionFees",
      "Error getting redemption fees",
      params
    );

    const redemptionFeesAPIResponse: RedemptionFeesAPIResponse = response.data;
    const redemptionFeesAPI: RedemptionFeesAPI = redemptionFeesAPIResponse.data;

    return {
      estimatedGasFee: redemptionFeesAPI.estimatedGasFee,
      atlasProtocolFee: redemptionFeesAPI.atlasProtocolFee,
      estimatedFeeRate: redemptionFeesAPI.estimatedFeeRate,
    };
  } catch (error) {
    console.error("Failed to fetch redemption fees:", error);
    throw error;
  }
};
