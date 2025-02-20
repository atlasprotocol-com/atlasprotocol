import { getRedemptionFees } from "@/app/api/getRedemptionFees";

export const getTxRedemptionFees = async (
  amount: number,
) => {
  try {
    const { estimatedRedemptionFee, atlasProtocolFee, estimatedRedemptionFeeRate } =
      // await getRedemptionFees(sender_address, amount, txn_hash);
      // amount > 0 will throw an error
      await getRedemptionFees(amount);
    return { estimatedRedemptionFee, atlasProtocolFee, estimatedRedemptionFeeRate };
  } catch (error) {
    console.error("Failed to fetch redemption fees:", error);
  }
};
