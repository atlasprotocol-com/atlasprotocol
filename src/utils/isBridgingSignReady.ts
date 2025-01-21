// Check if the staking transaction is ready to be signed
export const isBridgingSignReady = (
    // Parameter min and max values
    minAmount: number,
    maxAmount: number,
    // Actual values
    amount: number
  ): { isReady: boolean; reason: string } => {
    // Amount parameters are ready
    const amountParamatersReady = minAmount && maxAmount;
    // App values are filled
    const amountValuesReady = amount >= minAmount && amount <= maxAmount;
    // Amount is ready
    const amountIsReady = amountParamatersReady && amountValuesReady;
  
    if (!amountIsReady) {
      return {
        isReady: false,
        reason: "Please enter a valid bridging amount",
      };
    }
    return {
      isReady: true,
      reason: "",
    };
  };
  