import { apiWrapper } from "./apiWrapper";

interface RedemptionFeesAPIResponse {
  data: RedemptionFeesAPI;
}

interface RedemptionFeesAPI {
  estimatedGasFee: number;
  estimatedReceiveAmount: number;
  atlasRedemptionFee: number;
}

interface RedemptionFees {
  estimatedGasFee: number;
  estimatedReceiveAmount: number;
  atlasRedemptionFee: number;
}

export const getRedemptionFees = async (
  sender_address: string,
  amount: number,
  txn_hash: string,
): Promise<RedemptionFees> => {
  try {
    const params = {
      sender: sender_address,
      amount: amount,
      redemptionTxnHash: txn_hash,
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
      estimatedReceiveAmount: redemptionFeesAPI.estimatedReceiveAmount,
      atlasRedemptionFee: redemptionFeesAPI.atlasRedemptionFee,
    };
  } catch (error) {
    console.error("Failed to fetch redemption fees:", error);
    throw error;
  }
};
