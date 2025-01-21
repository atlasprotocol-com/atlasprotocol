let globalParams = {
  mpc_contract: null,
  stakingCap: 0,
  maxStakingAmount: 0,
  minStakingAmount: 0,
  atlasRedemptionFeePercentage: 0,
  atlasDepositFeePercentage: 0,
  atlasYieldProviderRewardsFeePercentage: 0,
  atlasBridgingFeePercentage: 0,
  atlasTreasuryAddress: null,
  maxRetryCount: 1,
};

// Function to fetch and update globalParams
async function updateGlobalParams(near) {
  try {
    console.log("Fetching global parameters from NEAR");
    const fetchedParams = await near.getGlobalParams();

    // Update the globalParams object
    globalParams.mpc_contract = fetchedParams.mpc_contract;
    globalParams.stakingCap = fetchedParams.btc_staking_cap;
    globalParams.maxStakingAmount = fetchedParams.btc_max_staking_amount;
    globalParams.minStakingAmount = fetchedParams.btc_min_staking_amount;
    globalParams.atlasRedemptionFeePercentage =
      fetchedParams.fee_redemption_bps / 10000;
    globalParams.atlasDepositFeePercentage =
      fetchedParams.fee_deposit_bps / 10000;
    globalParams.atlasYieldProviderRewardsFeePercentage =
      fetchedParams.fee_yield_provider_rewards_bps / 10000;
    globalParams.atlasBridgingFeePercentage =
      fetchedParams.fee_bridging_bps / 10000;
    globalParams.atlasTreasuryAddress = fetchedParams.treasury_address;
    globalParams.maxRetryCount = fetchedParams.max_retry_count || 1;

    console.log("Global parameters loaded successfully:", globalParams);
  } catch (error) {
    console.error("Failed to fetch and loaded global params:", error);
  }
}

module.exports = {
  globalParams,
  updateGlobalParams,
};
