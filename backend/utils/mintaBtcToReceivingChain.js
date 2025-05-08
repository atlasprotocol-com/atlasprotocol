const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");
const address = require("../services/address");
const { updateOffchainDepositStatus, updateOffchainDepositRemarks } = require("../helpers/depositsHelper");

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

      if (filteredTxns.length === 0) {
        console.log(`${batchName} No deposits to process.`);
        return;
      }

      console.log(
        "[mintAtbtcToReceivingChain] records to mint to atBTC: ",
        filteredTxns.length
      );

      // Group transactions by chainID
      const transactionsByChain = filteredTxns.reduce((acc, deposit) => {
        const chainId = deposit.receiving_chain_id;
        if (!acc[chainId]) {
          acc[chainId] = [];
        }
        acc[chainId].push(deposit);
        return acc;
      }, {});

      // Process each chain's transactions
      for (const [chainId, chainTransactions] of Object.entries(transactionsByChain)) {
        console.log(`Processing ${chainTransactions.length} transactions for chain ${chainId}`);
        
        const chainConfig = getChainConfig(chainId);

        if (!chainConfig) {
          throw new Error(`Chain config not found for chain ID: ${chainId}`);
        }

        if (chainConfig.networkType === NETWORK_TYPE.EVM) {
          console.log(`Starting EVM chain processing for chain ${chainId}`);
          const ethereum = new Ethereum(
            chainConfig.chainID,
            chainConfig.chainRpcUrl,
            chainConfig.gasLimit,
            chainConfig.aBTCAddress,
            chainConfig.abiPath,
          );
          
          let derivationPath = chainConfig.networkType;

          // Generate the derived address for the aBTC minter & sender
          const sender = await ethereum.deriveEthAddress(
            await near.nearMPCContract.public_key(),
            near.contract_id,
            derivationPath,
          );

          const events = await ethereum.getEventsByType("MintDeposit");
          console.log(`Found ${events.length} MintDeposit events for chain ${chainId}`);
    
          let totalRecords = chainTransactions.length;
          let currentIndex = 0;

          console.log(`Processing EVM Chain signatures`);

          for (const depositRecord of chainTransactions) {
            const btcTxnHash = depositRecord.btc_txn_hash;
            currentIndex++;
            console.log(`[mintAtbtcToReceivingChain] Processing record ${currentIndex} of ${totalRecords} for chain ${chainId}: minting with BTC txn hash ${btcTxnHash}`);
            try {
              
              if (depositRecord.verified_count < chainConfig.validators_threshold) {
                throw new Error(`Verified count is less than validators threshold: ${depositRecord.verified_count} < ${chainConfig.validators_threshold}`);
              }
                   
              if (
                !address.isValidEthereumAddress(depositRecord.receiving_address)
              ) {
                throw new Error(
                  `Invalid receiving address: ${depositRecord.receiving_address}`,
                );
              }

              // Find the event with matching BTC transaction hash
              const matchingEvent = events.find(event => 
                event.args.btcTxnHash.toLowerCase() === btcTxnHash.toLowerCase()
              );
  
              if (matchingEvent) {
                const evmTransactionHash = matchingEvent.transactionHash;
                console.log(`Event found for BTC txn hash ${btcTxnHash}: EVM transaction hash ${evmTransactionHash}`);
                // Update the deposit record with the EVM transaction hash
                await near.updateDepositMintedTxnHash(btcTxnHash, transactionHash);
      
                updateOffchainDepositStatus(allDeposits, btcTxnHash, DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC);
      
                continue;
              } else {
                console.log(`No event found for BTC txn hash ${btcTxnHash}`);
              } 

              console.log(`Minter and sender address: ${sender}`);

              // Create payload to deploy the contract
              console.log(`Creating EVM and Sign payload...`);
              const { nonce, signed } = await ethereum.createMintaBtcSignedTx(
                near,
                sender,
                depositRecord.receiving_address,
                depositRecord.btc_amount - depositRecord.yield_provider_gas_fee - depositRecord.minting_fee - depositRecord.protocol_fee,
                btcTxnHash,
                depositRecord.minting_fee,
              );

              // Check if signedTransaction is an empty Uint8Array
              if (signed.length === 0) {
                console.error("Signed transaction is empty. Aborting process.");
                return;
              }

              // Relay the transaction to EVM
              // console.log(`Relay transaction to EVM...`);

              const { txnHash, status } =
              await ethereum.relayTransaction(nonce, sender, signed);
              console.log(
                "\x1b[35m%s\x1b[0m",
                `Processed Txn: Mint aBTC with BTC txn hash ${btcTxnHash}, mintStatus = ${status}`,
              );

              updateOffchainDepositStatus(allDeposits, btcTxnHash, DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC);

              if (status===false) {
                let remarks = `Error ${batchName} processing Txn with BTC txn hash ${btcTxnHash}: Transaction relayer return with error`;
                console.error(remarks);
                await near.updateDepositRemarks(btcTxnHash, remarks);
                updateOffchainDepositRemarks(allDeposits, btcTxnHash, remarks);
              }
            } catch (error) {
              let remarks = `Error ${batchName} processing Txn with BTC txn hash ${btcTxnHash}: ${error}`;
              console.error(remarks);
              if (!error.message.includes("Gas price is less than base fee per gas")) {
                await near.updateDepositRemarks(btcTxnHash, remarks);
                updateOffchainDepositRemarks(allDeposits, btcTxnHash, remarks);
              }
              continue
            }
          }
        } else if (chainConfig.networkType === NETWORK_TYPE.NEAR) {
          console.log(`Starting NEAR chain processing for chain ${chainId}`);
          let totalRecords = chainTransactions.length;
          let currentIndex = 0;

          for (const depositRecord of chainTransactions) {
            const btcTxnHash = depositRecord.btc_txn_hash;
            currentIndex++;
            console.log(`[mintAtbtcToReceivingChain] Processing record ${currentIndex} of ${totalRecords} for chain ${chainId}: minting with BTC txn hash ${btcTxnHash}`);
            
            try {
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
              
              updateOffchainDepositStatus(allDeposits, btcTxnHash, DEPOSIT_STATUS.BTC_PENDING_MINTED_INTO_ABTC);

              console.log(signedTransaction);

            } catch (error) {
              let remarks = `Error ${batchName} processing Txn with BTC txn hash ${btcTxnHash}: ${error}`;
              console.error(remarks);
              if (!error.message.includes("Gas price is less than base fee per gas")) {
                await near.updateDepositRemarks(btcTxnHash, remarks);
                updateOffchainDepositRemarks(allDeposits, btcTxnHash, remarks);
              }
              continue;
            }
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
