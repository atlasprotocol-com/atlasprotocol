import { apiWrapper } from "./apiWrapper";

interface BridgingFeesAPIResponse {
  data: BridgingFeesAPI;
}

interface BridgingFeesAPI {
  estimatedBridgingFee: number;
  atlasProtocolFee: number;
  estimatedBridgingFeeRate: number;
}

interface BridgingFees {
  estimatedBridgingFee: number;
  atlasProtocolFee: number;
  estimatedBridgingFeeRate: number;
}

export const getBridgingFees = async (
  amount: number,
): Promise<BridgingFees> => {
  try {
    const params = {
      amount: amount,
    };

    const response = await apiWrapper(
      "GET", 
      "/api/v1/atlas/bridgingFees",
      "Error getting bridging fees",
      params
    );

    const bridgingFeesAPIResponse: BridgingFeesAPIResponse = response.data;
    const bridgingFeesAPI: BridgingFeesAPI = bridgingFeesAPIResponse.data;

    return {
      estimatedBridgingFee: bridgingFeesAPI.estimatedBridgingFee,
      atlasProtocolFee: bridgingFeesAPI.atlasProtocolFee,
      estimatedBridgingFeeRate: bridgingFeesAPI.estimatedBridgingFeeRate,
    };
  } catch (error) {
    console.error("Failed to fetch bridging fees:", error);
    throw error;
  }
};
