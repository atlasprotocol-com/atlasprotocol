import { isValidAddress } from "@/utils/validateAddress";

// Check if the staking transaction is ready to be signed
export const isStakingSignReady = (
  // Parameter min and max values
  minAmount: number,
  maxAmount: number,
  // Actual values
  amount: number,
  stakingCap: number,
  totalTVLSat: number,
  stakingReceivingAddress: string,
  networkType: string
): { isReady: boolean; reason: string } => {
  // Amount parameters are ready
  const amountParamatersReady = minAmount && maxAmount;
  // App values are filled
  const amountValuesReady = amount >= minAmount && amount <= maxAmount;

  const stakingCapReady = stakingCap > totalTVLSat;

  // Amount is ready
  const amountIsReady = amountParamatersReady && amountValuesReady;

  const validateAddress = isValidAddress(networkType, stakingReceivingAddress)

  if (!amountIsReady) {
    return {
      isReady: false,
      reason: "Please enter a valid stake amount",
    };
  }

  if (!stakingCapReady) {
    return {
      isReady: false,
      reason: "Staking cap reached",
    };
  }

  if (!validateAddress) {
    return {
      isReady: false,
      reason: `${stakingReceivingAddress} is not a valid address for network type ${networkType || 'unknown'}`,
    };
  }

  return {
    isReady: true,
    reason: "",
  };


};
