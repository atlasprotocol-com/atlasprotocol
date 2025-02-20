import { getBridgingFees } from "@/app/api/getBridgingFees";

export const getTxBridgingFees = async (
  amount: number,
) => {
  try {
    const { estimatedBridgingFee, atlasProtocolFee, estimatedBridgingFeeRate } =
      // await getBridgingFees(sender_address, amount, txn_hash);
      // amount > 0 will throw an error
      await getBridgingFees(amount);
    return { estimatedBridgingFee, atlasProtocolFee, estimatedBridgingFeeRate };
  } catch (error) {
    console.error("Failed to fetch bridging fees:", error);
  }
};
