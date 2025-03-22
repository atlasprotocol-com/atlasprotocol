const bitcoinlib = require("bitcoinjs-lib");
const { getConstants, fetchAndSetConstants } = require("../constants");
const { globalParams } = require("../config/globalParams");
const { createRelayerClient } = require("@bithive/relayer-api");

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

async function WithdrawFailDepositsOfBithive(btcTxnHash, near, bitcoin) {
  const record = await near.getDepositByBtcTxnHash(btcTxnHash);
  if (!record) {
    console.error(`[${btcTxnHash}] not found`);
    return;
  }
  if (!record.yield_provider_txn_hash) {
    console.error(`[${btcTxnHash}] yield_provider_txn_hash is empty`);
    return;
  }

  const amount = record.btc_amount - record.yield_provider_gas_fee;
  if (!Number.isSafeInteger(amount)) {
    console.error(`[${btcTxnHash}] ${amount} is invalid`);
    return;
  }

  const { publicKey, address } = await bitcoin.deriveBTCAddress(near);
  const pkstr = publicKey.toString("hex");
  console.log(`[${address}] [${pkstr}] ---> ${amount}`);

  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });
  const { account } = await relayer.user.getAccount({
    publicKey: pkstr,
  });
  if (account.pendingSignPsbt) {
    console.log(
      `[${address}] [${pkstr}] ${JSON.stringify(pendingSignPsbt, null, 2)}`,
    );
  }

  const yptx = record.yield_provider_txn_hash;
  const { deposit } = await relayer.user.getDeposit({
    publicKey: pkstr,
    txHash: yptx,
  });
  if (!deposit) {
    console.error(`[${address}] [${pkstr}] [${yptx}] deposit is empty`);
    return;
  }

  const { psbt: unsignedPsbtHex, deposits: depositsToSign } =
    await relayer.withdraw.buildUnsignedPsbt({
      publicKey: pkstr,
      amount,
      recipientAddress: address,
    });
  if (!unsignedPsbtHex) {
    console.error(`[${address}] [${pkstr}] unsignedPsbtHex is empty`);
    return;
  }

  if (!depositsToSign) {
    console.error(`[${address}] [${pkstr}] depositsToSign is empty`);
    return;
  }

  let partiallySignedPsbt = await bitcoin.mpcSignPsbt(near, unsignedPsbtHex);
  if (!partiallySignedPsbt) {
    console.error(`[${address}] [${pkstr}] depositsToSign is empty`);
    return;
  }

  const { psbt: fullySignedPsbt } = await relayer.withdraw.chainSignPsbt({
    psbt: partiallySignedPsbt.toHex(),
  });

  let finalisedPsbt = bitcoinlib.Psbt.fromHex(fullySignedPsbt, {
    network: bitcoinInstance.network,
  });
  console.log("finalisedPsbt ------------------=>", finalisedPsbt);

  const { txHash } = await relayer.withdraw.submitFinalizedPsbt({
    psbt: fullySignedPsbt,
  });

  return txHash;
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
    const tx = await WithdrawFailDepositsOfBithive(
      process.argv[2],
      near,
      bitcoin,
    );
    console.log(`Transaction hash: ${tx}`);
  });
}
