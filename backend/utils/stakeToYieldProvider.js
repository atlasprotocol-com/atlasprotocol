const { createRelayerClient } = require('@bithive/relayer-api');

const { getConstants } = require("../constants");


const { flagsBatch } = require("./batchFlags");

async function StakeToYieldProvider(allDeposits, near, bitcoinInstance) {
  const batchName = `Batch B StakeToYieldProvider`;

  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });

  // Check if a previous batch is still running
  if (flagsBatch.stakeToYieldProviderRunning) {
    console.log(`Previous ${batchName} incomplete. Skipping this run.`);
    return;
  } else {
    try {
      console.log(`${batchName}. Start run...`);
      flagsBatch.stakeToYieldProviderRunning = true;

      const { DEPOSIT_STATUS } = getConstants(); // Access constants dynamically

      const { address, publicKey } =
        await bitcoinInstance.deriveBTCAddress(near);

      const unconfirmedCount =
        await bitcoinInstance.getPendingOutCount(address);

      console.log("unconfirmedCount: ", unconfirmedCount);
      console.log("address: ", address);

      if (unconfirmedCount && unconfirmedCount >= 20) {
        console.log(
          "Unconfirmed out going transactions > 20. Skipping this run.",
        );
        return;
      }

      // Filter deposits that need to be processed
      const filteredDeposits = allDeposits.filter(
        (deposit) =>
          deposit.btc_sender_address !== "" &&
          deposit.receiving_chain_id !== "" &&
          deposit.receiving_address !== "" &&
          deposit.status === DEPOSIT_STATUS.BTC_DEPOSITED_INTO_ATLAS &&
          deposit.remarks === "" &&
          deposit.minted_txn_hash === "" &&
          deposit.btc_amount > 0 &&
          deposit.date_created > 0,
      );

      for (const depositRecord of filteredDeposits) {
        console.log("Processing deposit:", depositRecord);
        const btcTxnHash = depositRecord.btc_txn_hash;
        const btcAmount = depositRecord.btc_amount;
        const yieldProviderGasFee = depositRecord.yield_provider_gas_fee;
        const protocolFee = depositRecord.protocol_fee;
        const mintingFee = depositRecord.minting_fee;

        try {
          await near.updateDepositPendingYieldProviderDeposit(btcTxnHash);

          // Convert publicKey to a string
          const publicKeyString = publicKey.toString("hex");

          const amountToSend =
            Number(btcAmount) -
            Number(yieldProviderGasFee) -
            Number(protocolFee) -
            Number(mintingFee);
          console.log("amountToSend: ", amountToSend);

          // 1. Build the PSBT that is ready for signing
          const { psbt: unsignedPsbtHex } =
            await relayer.deposit.buildUnsignedPsbt({
              publicKey: publicKeyString,
              address,
              amount: amountToSend,
              fee: Number(yieldProviderGasFee),
            });

          // 2. Sign the PSBT via chain signature
          const signedPsbt = await bitcoinInstance.mpcSignPsbt(
            near,
            unsignedPsbtHex,
          );

          signedPsbt.finalizeAllInputs();
          const signedPsbtHex = signedPsbt.toHex();

          // 3. Submit the finalized PSBT for broadcasting and relaying
          const { txHash } = await relayer.deposit.submitFinalizedPsbt({
            psbt: signedPsbtHex,
            publicKey: publicKeyString,
          });

          console.log("txHash:", txHash);

          console.log("Status updated");

          await near.updateYieldProviderTxnHash(btcTxnHash, txHash);

          console.log(`${batchName} completed successfully.`);

        } catch (error) {
          let remarks = "";
          console.log("error: ", error);
          // Log the error data if available
          if (error.response && error.response.data.error.message) {
            console.log("error.response.data", error.response.data);
            remarks = `Error staking to yield provider: ${JSON.stringify(error.response.data.error.message)}`;
          } else {
            remarks = `Error staking to yield provider: ${error} - ${error.reason}`;
          }
          console.error(remarks);
          await near.updateDepositRemarks(btcTxnHash, remarks);
          return;
        }
      }
    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.stakeToYieldProviderRunning = false;
    }
  }
}

async function getBithiveDeposits(publicKey) {
  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });
  const deposits = await relayer.user.getDeposits({
    publicKey: publicKey,
  });
  return deposits;
}

module.exports = { StakeToYieldProvider, getBithiveDeposits };
