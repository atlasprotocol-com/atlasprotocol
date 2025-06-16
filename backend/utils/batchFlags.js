// batchFlags.js
const flagsBatch = {
  GetAllDepositHistoryRunning: false,
  GetAllRedemptionHistoryRunning: false,
  GetBithiveRecordsRunning: false,
  
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
  UpdateYieldProviderStakedRunning: false,
  UpdateYieldProviderUnstakedRunning: false,
  UpdateAtlasBtcWithdrawnFromYieldProviderRunning: false,
  UpdateAtlasBtcBridgingYieldProviderWithdrawnRunning: false,
  RetrieveAndProcessPastNearEventsRunning: false,
  RetrieveAndProcessPastEvmEventsRunning: false,
  ProcessUnstakingAndWithdrawalRunning: false,
  SendBridgingFeesToTreasuryRunning: false,
  UpdateAtlasBtcDepositedRunning: false,
  UpdateAtlasRedemptionPendingBtcMempoolRunning: false,
  UpdateBridgingAtbtcMintedRunning: false,
  GetAllBridgingHistoryRunning: false,
  RetrieveAndProcessPastEventsRunning: false,
  MintingEventsRunning: false,
  WithdrawBtcFromYieldProviderRunning: false,
  UnstakeBtcFromYieldProviderRunning: false,
  NearChainScannerRunning: false,
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
