const { createRelayerClient } = require("@bithive/relayer-api");

const { getConstants } = require("../constants");

const { getChainConfig } = require("./network.chain.config");
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

      // const unconfirmedCount =
      //   await bitcoinInstance.getPendingOutCount(address);

      // console.log("unconfirmedCount: ", unconfirmedCount);
      // console.log("address: ", address);

      // if (unconfirmedCount && unconfirmedCount >= 20) {
      //   console.log(
      //     "Unconfirmed out going transactions > 20. Skipping this run.",
      //   );
      //   return;
      // }

      // Filter deposits that need to be processed
      const filteredDeposits = allDeposits
        .filter(
          (deposit) => {
            try {
              if (deposit.remarks === "") {
                const chainConfig = getChainConfig(deposit.receiving_chain_id);
                return deposit.btc_sender_address !== "" &&
                  deposit.receiving_chain_id !== "" &&
                  deposit.receiving_address !== "" &&
                  deposit.status === DEPOSIT_STATUS.BTC_DEPOSITED_INTO_ATLAS &&
                  deposit.remarks === "" &&
                  deposit.minted_txn_hash === "" &&
                  deposit.btc_amount > 0 &&
                  deposit.date_created > 0 &&
                  deposit.verified_count >= chainConfig.validators_threshold;
              }
            } catch (error) {
              const remarks = `Chain config not found for chain ID: ${deposit.receiving_chain_id}`;
              near.updateDepositRemarks(deposit.btc_txn_hash, remarks);
              return false;
            }
          }
        )
        //.slice(0, 1); // Get only first record

        console.log("filteredDeposits in stakeToYieldProvider: ", filteredDeposits.length);
        let i = 0;
      for (const depositRecord of filteredDeposits) {
        console.log("stakeToYieldProvider loop: ", i++);
        console.log("Processing deposit:", depositRecord);
        const btcTxnHash = depositRecord.btc_txn_hash;
        const yieldProviderGasFee = depositRecord.yield_provider_gas_fee;

        try {
          
          const deposit = await near.getDepositByBtcTxnHash(btcTxnHash);

          // Another check to ensure the onchain deposit is in the correct status
          if (deposit.status === DEPOSIT_STATUS.BTC_DEPOSITED_INTO_ATLAS && deposit.remarks === "") {
            await near.updateDepositPendingYieldProviderDeposit(btcTxnHash);
          }
          else {
            continue;
          }

          // Convert publicKey to a string
          const publicKeyString = publicKey.toString("hex");

          const utxos = await bitcoinInstance.getUtxosByTxid(
            address,
            btcTxnHash,
          );
         
          // 1. Build the PSBT that is ready for signing
          const { psbt: unsignedPsbtHex } =
            await relayer.deposit.buildUnsignedPsbt({
              utxos,
              publicKey: publicKeyString,
              address,
              btcTxnHash,
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
          if (error.message.includes("Empty UTXOs")) {
            console.log("Empty UTXOs error");
            const spendingTxs = await bitcoinInstance.findSpendingTransaction(btcTxnHash);
            console.log("spendingTxs: ", spendingTxs);
            if (spendingTxs) {
              await near.updateYieldProviderTxnHash(btcTxnHash, spendingTxs);
            }
            else {
              await near.updateDepositRemarks(btcTxnHash, remarks);
            }
          }
          else {
            
            await near.updateDepositRemarks(btcTxnHash, remarks);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.stakeToYieldProviderRunning = false;
    }
  }
}

async function getBithiveDeposits(publicKeyHex, totalDeposits) {

  if (totalDeposits <= 0) {
    return [];
  }

  const relayer = createRelayerClient({ url: process.env.BITHIVE_RELAYER_URL });
  let deposits = [];
  let offset = 0;
  const limit = 1000;

  try {
    // First, get the first batch to check if there are any deposits
    const { deposits: firstBatch } = await relayer.user.getDeposits({
      publicKey: publicKeyHex, 
      offset: 0,
      limit
    });

    if (firstBatch.length === 0) {
      return deposits;
    }

    deposits = deposits.concat(firstBatch);
    offset += limit;

    const totalBatches = Math.ceil(totalDeposits / limit);

    // Create an array of promises for parallel fetching
    const batchPromises = [];
    for (let i = 1; i < totalBatches; i++) {
      const currentOffset = i * limit;
      batchPromises.push(
        relayer.user.getDeposits({
          publicKey: publicKeyHex,
          offset: currentOffset,
          limit
        })
      );
    }

    // Fetch all batches in parallel
    const batchResults = await Promise.all(batchPromises);
    
    // Combine all results
    batchResults.forEach(result => {
      deposits = deposits.concat(result.deposits);
    });

    console.log("[getBithiveDeposits] Total bithive deposits fetched:", deposits.length);
    return deposits;
  } catch (error) {
    console.error("Failed to fetch Bithive deposits:", error);
    throw error;
  }
}

module.exports = { StakeToYieldProvider, getBithiveDeposits };
