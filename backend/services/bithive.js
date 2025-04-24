const { createRelayerClient } = require("@bithive/relayer-api");
const bitcoin = require("bitcoinjs-lib");

async function estimateRedemptionFees(bitcoinInstance, near, amount) {
  try {
    const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });
        const { publicKey, address } = await bitcoinInstance.deriveBTCAddress(near);
        const publicKeyString = publicKey.toString("hex");

        let feeRate;
       
        feeRate = await bitcoinInstance.fetchFeeRate() + 1;
      
        if (!feeRate) {
          console.error("No fee rate found");
          feeRate = 1;
        }

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

        // Calculate estimated redemption fee
        const estimatedRedemptionFee = estimatedVSize * feeRate;

        return {
            estimated_redemption_fee: estimatedRedemptionFee,      // Total fee in satoshis
            estimated_redemption_tx_size: estimatedVSize, // Estimated transaction size in vBytes
            estimated_redemption_fee_rate: feeRate        // Fee rate in sat/vByte
        };
    } catch (error) {
        console.error("Error estimating fee:", error);
        return { error: "Failed to process PSBT" };
    }
}

async function estimateBridgingFees(bitcoinInstance, near, amount) {
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

        // Calculate estimated redemption fee
        const estimatedBridgingFee = estimatedVSize * feeRate;

        return {
            estimated_bridging_fee: estimatedBridgingFee,      // Total fee in satoshis
            estimated_bridging_tx_size: estimatedVSize, // Estimated transaction size in vBytes
            estimated_bridging_fee_rate: feeRate        // Fee rate in sat/vByte
        };
    } catch (error) {
        console.error("Error estimating fee:", error);
        return { error: "Failed to process PSBT" };
    }
}

module.exports = {
  estimateRedemptionFees,
  estimateBridgingFees
};
