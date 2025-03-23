const { createRelayerClient } = require("@bithive/relayer-api");
const bitcoin = require("bitcoinjs-lib");

const relayer = createRelayerClient({
  url: process.env.BITHIVE_RELAYER_URL,
});

async function estimateRedemptionFees(bitcoinInstance, near, amount) {
  try {
    const { publicKey, address } = await bitcoinInstance.deriveBTCAddress(near);
    const publicKeyString = publicKey.toString("hex");

    // Get the latest fee rate
    const feeRate = (await bitcoinInstance.fetchFeeRate()) + 1;

    const { psbt: unsignedPsbt } = await relayer.withdraw.buildUnsignedPsbt({
      publicKey: publicKeyString,
      amount: Number(amount),
      recipientAddress: address,
      feeRate: feeRate,
    });

    // Parse the PSBT
    const psbt = bitcoin.Psbt.fromHex(unsignedPsbt);

    // Count inputs and outputs
    const numInputs = psbt.txInputs.length;
    const numOutputs = psbt.txOutputs.length;

    // Estimate transaction size (SegWit P2WPKH)
    const estimatedVSize = numInputs * 68 + numOutputs * 31 + 10;

    // Calculate estimated redemption fee
    const estimatedRedemptionFee = estimatedVSize * feeRate;

    return {
      estimated_redemption_fee: estimatedRedemptionFee, // Total fee in satoshis
      estimated_redemption_tx_size: estimatedVSize, // Estimated transaction size in vBytes
      estimated_redemption_fee_rate: feeRate, // Fee rate in sat/vByte
    };
  } catch (error) {
    console.error("Error estimating fee:", error);
    return { error: "Failed to process PSBT" };
  }
}

async function estimateBridgingFees(bitcoinInstance, near, amount) {
  try {
    const { publicKey, address } = await bitcoinInstance.deriveBTCAddress(near);
    const publicKeyString = publicKey.toString("hex");

    // Get the latest fee rate
    const feeRate = (await bitcoinInstance.fetchFeeRate()) + 1;

    const { psbt: unsignedPsbt } = await relayer.withdraw.buildUnsignedPsbt({
      publicKey: publicKeyString,
      amount: Number(amount),
      recipientAddress: address,
      feeRate: feeRate,
    });

    // Parse the PSBT
    const psbt = bitcoin.Psbt.fromHex(unsignedPsbt);

    // Count inputs and outputs
    const numInputs = psbt.txInputs.length;
    const numOutputs = psbt.txOutputs.length;

    // Estimate transaction size (SegWit P2WPKH)
    const estimatedVSize = numInputs * 68 + numOutputs * 31 + 10;

    // Calculate estimated redemption fee
    const estimatedBridgingFee = estimatedVSize * feeRate;

    return {
      estimated_bridging_fee: estimatedBridgingFee, // Total fee in satoshis
      estimated_bridging_tx_size: estimatedVSize, // Estimated transaction size in vBytes
      estimated_bridging_fee_rate: feeRate, // Fee rate in sat/vByte
    };
  } catch (error) {
    console.error("Error estimating fee:", error);
    return { error: "Failed to process PSBT" };
  }
}

async function unstake(bitcoinInstance, near, amount) {
  const { publicKey, address } = await bitcoinInstance.deriveBTCAddress(near);
  const publicKeyString = publicKey.toString("hex");

  const { account } = await relayer.user.getAccount({
    publicKey: publicKeyString,
  });
  if (
    account.unstakingEndTimestamp &&
    account.unstakingEndTimestamp > Date.now()
  ) {
    console.error(
      `[${address}] unstakingEndTimestamp: ${JSON.stringify(account, null, 2)}`,
    );
    return false;
  }

  const { message } = await relayer.unstake.buildUnsignedMessage({
    amount,
    publicKey: publicKeyString,
  });
  if (!message) {
    throw new Error(`[${address}] message is empty`);
  }

  const unstakeSignature = await bitcoinInstance.mpcSignMessage(near, message);
  if (!unstakeSignature) {
    throw new Error(`[${address}] unstakeSignature is empty`);
  }

  await relayer.unstake.submitSignature({
    amount,
    publicKey: publicKeyString,
    signature: unstakeSignature.toString("hex"),
  });

  return true;
}

async function withdraw(bitcoinInstance, near, amount) {
  const { publicKey, address } = await bitcoinInstance.deriveBTCAddress(near);
  const publicKeyString = publicKey.toString("hex");

  const { account } = await relayer.user.getAccount({
    publicKey: publicKeyString,
  });
  if (account.pendingSignPsbt) {
    console.error(
      `[${address}] pendingSignPsbt: ${JSON.stringify(account, null, 2)}`,
    );
    return;
  }

  const { psbt: unsignedPsbtHex, deposits: depositsToSign } =
    await relayer.withdraw.buildUnsignedPsbt({
      publicKey: publicKeyString,
      amount,
      recipientAddress: address,
    });

  if (!unsignedPsbtHex) {
    throw new Error(`[${address}] unsignedPsbtHex is empty`);
  }
  if (!depositsToSign) {
    throw new Error(`[${address}] depositsToSign is empty`);
  }

  const partiallySignedPsbt = await bitcoinInstance.mpcSignPsbt(
    near,
    unsignedPsbtHex,
  );
  if (!partiallySignedPsbt) {
    throw new Error(`[${address}] depositsToSign is empty`);
  }

  const { psbt: fullySignedPsbt } = await relayer.withdraw.chainSignPsbt({
    psbt: partiallySignedPsbt.toHex(),
  });
  if (!fullySignedPsbt) {
    throw new Error(`[${address}] fullySignedPsbt is empty`);
  }

  const finalisedPsbt = bitcoin.Psbt.fromHex(fullySignedPsbt, {
    network: bitcoinInstance.network,
  });
  if (!finalisedPsbt) {
    throw new Error(`[${address}] finalisedPsbt is empty`);
  }

  const { txHash } = await relayer.withdraw.submitFinalizedPsbt({
    psbt: fullySignedPsbt,
  });
  if (!txHash) {
    throw new Error(`[${address}] txHash is empty`);
  }

  return typeof txHash === "string" ? txHash : txHash.toString("hex");
}

async function getAccount(publicKey) {
  const relayer = createRelayerClient({
    url: process.env.BITHIVE_RELAYER_URL,
  });
  const { account } = await relayer.user.getAccount({
    publicKey,
  });

  return account;
}

module.exports = {
  estimateRedemptionFees,
  estimateBridgingFees,
  unstake,
  withdraw,
  getAccount,
};
