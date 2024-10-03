import { getRedemptionFees } from "@/app/api/getRedemptionFees";

export const getTxRedemptionFees = async (
  sender_address: string,
  amount: number,
  txn_hash: string,
) => {
  try {
    const { estimatedGasFee, estimatedReceiveAmount, atlasRedemptionFee } =
      await getRedemptionFees(sender_address, amount, txn_hash);
    return { estimatedGasFee, estimatedReceiveAmount, atlasRedemptionFee };
  } catch (error) {
    console.error("Failed to fetch redemption fees:", error);
  }
};
