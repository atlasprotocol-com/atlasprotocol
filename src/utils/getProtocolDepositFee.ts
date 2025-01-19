/**
 * Calculate the protocol deposit fee based on the fee percentage and staking amount.
 * 
 * @param feeDepositPercentage - The percentage of the fee to be applied.
 * @param stakingAmountSat - The staking amount in satoshis.
 * @returns The calculated fee or a minimum fee of 1000 satoshis if applicable.
 */
export function getProtocolDepositFee(feeDepositPercentage: number, stakingAmountSat: number): number {
    const actualFee = feeDepositPercentage * stakingAmountSat;
    
    if (feeDepositPercentage > 0) {
        return actualFee < 1000 ? 1000 : actualFee;
    }
    
    return 0;
} 