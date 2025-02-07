const { createRelayerClient } = require("@bithive/relayer-api");
const bitcoin = require("bitcoinjs-lib");

async function estimateRedemptionFees(bitcoinInstance, near, amount) {
  try {
    const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });
        const { publicKey, address } = await bitcoinInstance.deriveBTCAddress(near);
        const publicKeyString = publicKey.toString("hex");

        // Get the latest fee rate
        const feeRate = await bitcoinInstance.fetchFeeRate() + 1;

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
        const estimatedVSize = (numInputs * 68) + (numOutputs * 31) + 10;

        // Calculate estimated fee
        const estimatedFee = estimatedVSize * feeRate;

        return {
            estimated_fee: estimatedFee,      // Total fee in satoshis
            estimated_tx_size: estimatedVSize, // Estimated transaction size in vBytes
            estimated_fee_rate: feeRate        // Fee rate in sat/vByte
        };
    } catch (error) {
        console.error("Error estimating fee:", error);
        return { error: "Failed to process PSBT" };
    }
}

module.exports = {
  estimateRedemptionFees
};
