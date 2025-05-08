const { createRelayerClient } = require("@bithive/relayer-api");
const bitcoin = require("bitcoinjs-lib");

async function estimateRedemptionFees(bitcoinInstance, near, amount, bithiveRecords) {
  try {
    const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });
    const { publicKey, address } = await bitcoinInstance.deriveBTCAddress(near);
    const publicKeyString = publicKey.toString("hex");

    // Get the latest fee rate
    const feeRate = await bitcoinInstance.fetchFeeRate() + 1;

    console.log("bithiveRecords", bithiveRecords);

    // Sort UTXOs by smallest first
    const sortedUtxos = bithiveRecords.sort((a, b) => a.amount - b.amount);
    
    // Calculate how many inputs we need
    let totalAmount = 0;
    let numInputs = 0;
    
    for (const utxo of sortedUtxos) {
      console.log("utxo", utxo);
      totalAmount += utxo.amount;
      numInputs++;
      if (totalAmount >= Number(amount)) {
        break;
      }
    }

    // Estimate transaction size (SegWit P2WPKH)
    // We'll have 2 outputs: one for the recipient and one for change
    const numOutputs = 2;
    const estimatedVSize = (numInputs * 68) + (numOutputs * 31) + 10;

    // Calculate estimated redemption fee
    const estimatedRedemptionFee = estimatedVSize * feeRate;

    return {
      estimated_redemption_fee: estimatedRedemptionFee,      // Total fee in satoshis
      estimated_redemption_tx_size: estimatedVSize, // Estimated transaction size in vBytes
      estimated_redemption_fee_rate: feeRate,        // Fee rate in sat/vByte
      estimated_inputs: numInputs,                 // Number of inputs needed
      estimated_total_amount: totalAmount          // Total amount from selected UTXOs
    };
  } catch (error) {
    console.error("Error estimating fee:", error);
    return { error: "Failed to process fee estimation" };
  }
}

async function estimateBridgingFees(bitcoinInstance, near, amount, bithiveRecords) {
  try {
    const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });
    const { publicKey, address } = await bitcoinInstance.deriveBTCAddress(near);
    const publicKeyString = publicKey.toString("hex");

    // Get the latest fee rate
    const feeRate = await bitcoinInstance.fetchFeeRate() + 1;

    // Sort UTXOs by smallest first
    const sortedUtxos = bithiveRecords.sort((a, b) => a.amount - b.amount);
    
    // Calculate how many inputs we need
    let totalAmount = 0;
    let numInputs = 0;
    
    for (const utxo of sortedUtxos) {
      totalAmount += utxo.amount;
      numInputs++;
      if (totalAmount >= Number(amount)) {
        break;
      }
    }

    // Estimate transaction size (SegWit P2WPKH)
    // We'll have 2 outputs: one for the recipient and one for change
    const numOutputs = 2;
    const estimatedVSize = (numInputs * 68) + (numOutputs * 31) + 10;

    // Calculate estimated bridging fee
    const estimatedBridgingFee = estimatedVSize * feeRate;

    return {
      estimated_bridging_fee: estimatedBridgingFee,      // Total fee in satoshis
      estimated_bridging_tx_size: estimatedVSize, // Estimated transaction size in vBytes
      estimated_bridging_fee_rate: feeRate,        // Fee rate in sat/vByte
      estimated_inputs: numInputs,                 // Number of inputs needed
      estimated_total_amount: totalAmount          // Total amount from selected UTXOs
    };
  } catch (error) {
    console.error("Error estimating fee:", error);
    return { error: "Failed to process fee estimation" };
  }
}

module.exports = {
  estimateRedemptionFees,
  estimateBridgingFees
};
