const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");
const address = require("../services/address");

const { flagsBatch } = require("./batchFlags");
const { getChainConfig } = require("./network.chain.config");

async function MintaBtcToReceivingChain(allDeposits, near) {
  const batchName = `Batch E MintaBtcToReceivingChain`;

  if (flagsBatch.MintaBtcToReceivingChainRunning) {
    return;
  } else {
    try {
      console.log(`${batchName}. Start run ...`);
      flagsBatch.MintaBtcToReceivingChainRunning = true;

      const { NETWORK_TYPE, DEPOSIT_STATUS } = getConstants(); // Access constants dynamically

      // Filter deposits that need to be processed
      const filteredTxns = allDeposits.filter(
        (deposit) =>
          deposit.btc_sender_address && // non-empty check
          deposit.receiving_chain_id &&
          deposit.receiving_address &&
          deposit.status === DEPOSIT_STATUS.BTC_YIELD_PROVIDER_DEPOSITED &&
          !deposit.remarks && // empty check
          !deposit.minted_txn_hash &&
          deposit.btc_amount > 0 &&
          deposit.date_created > 0,
      );

      for (const depositRecord of filteredTxns) {
        const btcTxnHash = depositRecord.btc_txn_hash;
       
        try {

          const deposit = await near.getDepositByBtcTxnHash(btcTxnHash);

          // Another check to ensure the onchain deposit record is in the correct status
          if (deposit.status !== DEPOSIT_STATUS.BTC_YIELD_PROVIDER_DEPOSITED || deposit.remarks !== "") {
            continue;
          }

          const chainConfig = getChainConfig(depositRecord.receiving_chain_id);

          if (!chainConfig) {
            throw new Error(`Chain config not found for chain ID: ${depositRecord.receiving_chain_id}`);
          }
  
          if (depositRecord.verified_count < chainConfig.validators_threshold) {
            throw new Error(`Verified count is less than validators threshold: ${depositRecord.verified_count} < ${chainConfig.validators_threshold}`);
          }
  
          console.log("Record to mint aBTC:", depositRecord);

          
          if (chainConfig.networkType === NETWORK_TYPE.EVM) {
            if (
              !address.isValidEthereumAddress(depositRecord.receiving_address)
            ) {
              throw new Error(
                `Invalid receiving address: ${depositRecord.receiving_address}`,
              );
            }
           
            const ethereum = new Ethereum(
              chainConfig.chainID,
              chainConfig.chainRpcUrl,
              chainConfig.gasLimit,
              chainConfig.aBTCAddress,
              chainConfig.abiPath,
            );

            let derivationPath = chainConfig.networkType;

            console.log(`Processing EVM Chain signatures`);

            // Generate the derived address for the aBTC minter & sender
            const sender = await ethereum.deriveEthAddress(
              await near.nearMPCContract.public_key(),
              near.contract_id,
              derivationPath,
            );

            console.log(`Minter and sender address: ${sender}`);

            // Create payload to deploy the contract
            console.log(`Creating EVM and Sign payload...`);
            const signedTransaction = await ethereum.createMintaBtcSignedTx(
              near,
              sender,
              depositRecord.receiving_address,
              depositRecord.btc_amount - depositRecord.yield_provider_gas_fee - depositRecord.minting_fee - depositRecord.protocol_fee,
              btcTxnHash,
              depositRecord.minting_fee,
            );

            // Check if signedTransaction is an empty Uint8Array
            if (signedTransaction.length === 0) {
              console.error("Signed transaction is empty. Aborting process.");
              return;
            }

            // Relay the transaction to EVM
            console.log(`Relay transaction to EVM...`);

            const { txnHash, status } =
              await ethereum.relayTransaction(signedTransaction);
            console.log(
              "\x1b[35m%s\x1b[0m",
              `Processed Txn: Mint aBTC with BTC txn hash ${btcTxnHash}, mintStatus = ${status}`,
            );

            if (status !== 1n) {
              let remarks = `Error ${batchName} processing Txn with BTC txn hash ${btcTxnHash}: ${txnHash} return with error`;
              console.error(remarks);
              await near.updateDepositRemarks(btcTxnHash, remarks);
            }
          } else if (chainConfig.networkType === NETWORK_TYPE.NEAR) {
            console.log("Processing NEAR Chain signatures");

            if (!address.isValidNearAddress(depositRecord.receiving_address)) {
              throw new Error(
                `Invalid receiving address: ${depositRecord.receiving_address}`,
              );
            }
            const { gasPrice, mintingFeeUsd } =
              await near.calculateNearGasFeeFromMintingFee(
                depositRecord.receiving_address,
                depositRecord.minting_fee,
              );
            
            const payloadHeader = {
              btc_txn_hash: btcTxnHash,
              nonce: 0,
              gas: gasPrice,
              max_fee_per_gas: 0,
              max_priority_fee_per_gas: 0,
            };

            console.log("payloadHeader:", payloadHeader);

            // Create payload to deploy the contract
            console.log(`Minting aBTC on NEAR...`);
            const signedTransaction =
              await near.createMintaBtcSignedTx(payloadHeader);

            console.log(signedTransaction);
          }

        } catch (error) {
          let remarks = `Error ${batchName} processing Txn with BTC txn hash ${btcTxnHash}: ${error}`;
          console.error(remarks);
          if (!error.message.includes("Gas price is less than base fee per gas")) {
            await near.updateDepositRemarks(btcTxnHash, remarks);
          }
        }
      }

      console.log(`${batchName} completed successfully.`);
    } catch (error) {
      console.error(`Error ${batchName}:`, error);
    } finally {
      flagsBatch.MintaBtcToReceivingChainRunning = false;
    }
  }
}

module.exports = { MintaBtcToReceivingChain };
