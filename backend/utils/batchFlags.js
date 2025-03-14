// batchFlags.js
const flagsBatch = {
  UpdateAtlasBtcDepositsRunning: false,
  ValidateAtlasBtcDepositsRunning: false,
  MintaBtcToReceivingChainRunning: false,
  UpdateAtlasAbtcMintedRunning: false,
  ValidateAtlasBtcRedemptionsRunning: false,
  SendBtcBackToUserRunning: false,
  UpdateAtlasBtcBackToUserRunning: false,
  WithdrawFailDepositsRunning: false,
  UpdateWithdrawFailDepositsRunning: false,
  ValidateAtlasBtcBridgingsRunning: false,
  BridgeaBtcToDestChainRunning: false,
  StakeToYieldProviderRunning: false,
  UpdateYieldProviderStackedRunning: false,
  UpdateYieldProviderUnstakedRunning: false,
  UpdateAtlasBtcWithdrawnFromYieldProviderRunning: false,
  UpdateAtlasBtcBridgingYieldProviderWithdrawnRunning: false,
  RetrieveAndProcessPastNearEventsRunning: false,
  RetrieveAndProcessPastEvmEventsRunning: false,
  ProcessUnstakingAndWithdrawalRunning: false,
  SendBridgingFeesToTreasuryRunning: false,
  UpdateAtlasBtcDepositedRunning: false,
};

function blockRange(block, start = 1000, end = 2000) {
  if (!Number.isSafeInteger(block)) {
    return end;
  }

  if (block < start) return end;
  if (block > end) return end;

  return block;
}

module.exports = { flagsBatch, blockRange };
