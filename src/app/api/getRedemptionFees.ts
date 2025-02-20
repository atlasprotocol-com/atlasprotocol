import { apiWrapper } from "./apiWrapper";

interface RedemptionFeesAPIResponse {
  data: RedemptionFeesAPI;
}

interface RedemptionFeesAPI {
  estimatedRedemptionFee: number;
  atlasProtocolFee: number;
  estimatedRedemptionFeeRate: number;
}

interface RedemptionFees {
  estimatedRedemptionFee: number;
  atlasProtocolFee: number;
  estimatedRedemptionFeeRate: number;
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
      estimatedRedemptionFee: redemptionFeesAPI.estimatedRedemptionFee,
      atlasProtocolFee: redemptionFeesAPI.atlasProtocolFee,
      estimatedRedemptionFeeRate: redemptionFeesAPI.estimatedRedemptionFeeRate,
    };
  } catch (error) {
    console.error("Failed to fetch redemption fees:", error);
    throw error;
  }
};
