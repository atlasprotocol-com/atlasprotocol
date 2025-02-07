import { getRedemptionFees } from "@/app/api/getRedemptionFees";

export const getTxRedemptionFees = async (
  amount: number,
) => {
  try {
    const { estimatedGasFee, atlasProtocolFee, estimatedFeeRate } =
      // await getRedemptionFees(sender_address, amount, txn_hash);
      // amount > 0 will throw an error
      await getRedemptionFees(amount);
    return { estimatedGasFee, atlasProtocolFee, estimatedFeeRate };
  } catch (error) {
    console.error("Failed to fetch redemption fees:", error);
  }
};
