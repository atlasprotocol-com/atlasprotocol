const { getConstants, fetchAndSetConstants } = require("../constants");
const { globalParams, updateGlobalParams } = require("../config/globalParams");
const unstakingConfig = require("../config/unstakingConfig");
const bithive = require("../services/bithive");

const { flagsBatch } = require("./batchFlags");

const batchName = `-------------- Batch E WithdrawFailDeposits`;

async function WithdrawFailDeposits(allDeposits, near, bitcoin) {
  if (flagsBatch.WithdrawFailDepositsRunning) {
    return;
  }
  console.log(`${batchName}. Start run ...`);

  const { DEPOSIT_STATUS } = getConstants();
  const depositAddress =
    process.env.USE_COBO === "true"
      ? process.env.COBO_DEPOSIT_ADDRESS
      : process.env.BTC_ATLAS_DEPOSIT_ADDRESS;
  if (!depositAddress) {
    console.error(
      "Neither COBO_DEPOSIT_ADDRESS nor BTC_ATLAS_DEPOSIT_ADDRESS is set",
    );
    return;
  }

  flagsBatch.WithdrawFailDepositsRunning = true;

  try {
    const toBeRefund = allDeposits.filter(
      (d) =>
        d.status === DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC &&
        d.remarks &&
        d.retry_count >= globalParams.maxRetryCount,
    );

    for (const deposit of toBeRefund) {
      console.log(
        `${batchName}: ${deposit.btc_txn_hash} retry_count:${deposit.retry_count}`,
      );

      if (process.env.USE_COBO === "true") {
        const utxos = await bitcoin.fetchUTXOs(depositAddress);
        const result = await near.withdrawFailDepositByBtcTxHash({
          btc_txn_hash: deposit.btc_txn_hash,
          utxos: utxos,
          fee_rate: 0,
        });
        // If USE_COBO is true, run the Cobo integration logic
        //await runWithdrawFailDepositCoboIntegration(result.btc_txn_hash, near);
      } else {
        // Otherwise, run the original logic
        // To be implememted
      }
    }
  } catch (error) {
    console.error(`Error ${batchName}:`, error);
  } finally {
    flagsBatch.WithdrawFailDepositsRunning = false;
  }
}

async function WithdrawFailDepositsOfBithive(near, bitcoin, btcTxnHash) {
  const lastUnstakingTime = globalParams.lastUnstakingTime;
  const unstakingPeriod = await unstakingConfig.getUnstakingPeriod(near);
  const nextEligibleTime =
    lastUnstakingTime === 0 ? Date.now() : lastUnstakingTime + unstakingPeriod;

  console.log(
    `[${btcTxnHash}] last: ${lastUnstakingTime} next: ${nextEligibleTime}`,
  );
  if (Date.now() <= nextEligibleTime) {
    console.error("`${wfdob} Unstaking period has not been reached yet");
    return;
  }

  const record = await near.getDepositByBtcTxnHash(btcTxnHash);
  if (!record) {
    throw new Error(`[${btcTxnHash}] not found`);
  }
  if (!record.yield_provider_txn_hash) {
    throw new Error(`[${btcTxnHash}] yield_provider_txn_hash is empty`);
  }

  const amount = record.btc_amount - record.yield_provider_gas_fee;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`[${btcTxnHash}] ${amount} is invalid`);
  }

  await bithive.unstake(bitcoin, near, amount);
  await bithive.withdraw(bitcoin, near, amount);
}

module.exports = { WithdrawFailDeposits };

if (process.argv[1] === __filename) {
  const { Bitcoin } = require("../services/bitcoin");
  const { Near } = require("../services/near");

  if (!process.env.BITHIVE_RELAYER_URL) {
    throw new Error("BITHIVE_RELAYER_URL is not set");
  }
  if (!process.argv[2]) {
    throw new Error("Transaction hash is not set");
  }

  // Configuration for BTC connection
  const btcConfig = {
    btcAtlasDepositAddress: process.env.BTC_ATLAS_DEPOSIT_ADDRESS,
    btcAPI: process.env.BTC_MEMPOOL_API_URL,
    btcNetwork: process.env.BTC_NETWORK,
    btcDerivationPath: process.env.BTC_DERIVATION_PATH,
    btcAtlasTreasuryAddress: process.env.BTC_ATLAS_TREASURY_ADDRESS,
    evmAtlasAddress: process.env.EVM_ATLAS_ADDRESS,
  };
  const bitcoin = new Bitcoin(btcConfig.btcAPI, btcConfig.btcNetwork);

  // Configuration for NEAR connection
  const nearConfig = {
    networkId: process.env.NEAR_NETWORK_ID,
    nodeUrl: process.env.NEAR_NODE_URL,
    walletUrl: process.env.NEAR_WALLET_URL,
    helperUrl: process.env.NEAR_HELPER_URL,
    explorerUrl: process.env.NEAR_EXPLORER_URL,
    contractId: process.env.NEAR_CONTRACT_ID,
    mpcContractId: process.env.NEAR_MPC_CONTRACT_ID,
    accountId: process.env.NEAR_ACCOUNT_ID,
    pk: process.env.NEAR_PRIVATE_KEY,
    gas: process.env.NEAR_DEFAULT_GAS,
    bitHiveContractId: process.env.NEAR_BIT_HIVE_CONTRACT_ID,
  };

  const near = new Near(
    nearConfig.nodeUrl,
    nearConfig.accountId,
    nearConfig.contractId,
    nearConfig.pk,
    nearConfig.networkId,
    nearConfig.gas,
    nearConfig.mpcContractId,
    nearConfig.bitHiveContractId,
  );

  near.init().then(async () => {
    await fetchAndSetConstants(near);
    await updateGlobalParams(near);

    const btcTxnHash = process.argv[2];

    const tx = await WithdrawFailDepositsOfBithive(near, bitcoin, btcTxnHash);
    console.log(`Transaction hash: ${tx}`);
  });
}
