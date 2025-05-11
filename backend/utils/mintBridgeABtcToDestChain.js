const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");
const address = require("../services/address");
const { getBridgingRecordsToBridge, updateOffchainBridgingStatus, updateOffchainBridgingRemarks, updateOffchainBridgingMintedTxnHash } = require("../helpers/bridgingHelper");

const { getChainConfig } = require("./network.chain.config");
const { flagsBatch } = require("./batchFlags");

const GAS_FOR_MINT_CALL = 100; // Gas for minting call
const RECORDS_BEFORE_PAUSE = 10;

const batchName = `Batch K BridgeaBtcToDestChain`;
async function MintBridgeABtcToDestChain(allBridgings, near) {
  if (flagsBatch.BridgeaBtcToDestChainRunning) {
    return;
  } else {
    try { 
      console.log(`${batchName}. Start run ...`);
      flagsBatch.BridgeaBtcToDestChainRunning = true;

      const { NETWORK_TYPE, BRIDGING_STATUS } = getConstants(); // Access constants dynamically

      // Filter bridgings that meet the conditions
      const allBridgingsToBridge = getBridgingRecordsToBridge(allBridgings);
      console.log(`${batchName} Found ${allBridgingsToBridge.length} bridging to bridge.`);

      // Check if the result is null or undefined
      if (allBridgingsToBridge.length === 0) {
        console.log(`${batchName} No valid bridging or chain config found.`);
        return;
      }

      // Group transactions by chainID
      const transactionsByChain = allBridgingsToBridge.reduce((acc, bridging) => {
        const chainId = bridging.dest_chain_id;
        if (!acc[chainId]) {
          acc[chainId] = [];
        }
        acc[chainId].push(bridging);
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
          
          const events = await ethereum.getEventsByType("MintBridge");
          console.log(`Found ${events.length} MintBridge events for chain ${chainId}`);
    
          let totalRecords = chainTransactions.length;
          let currentIndex = 0;

          for (const bridging of chainTransactions) {
            const txnHash = bridging.txn_hash;
            currentIndex++;

            if (currentIndex % RECORDS_BEFORE_PAUSE === 0) {
              console.log(`[mintBridgeABtcToDestChain] Pausing for ${RECORDS_BEFORE_PAUSE} records...`);
              await new Promise(resolve => setTimeout(resolve, 10000));
            }

            console.log(`[mintBridgeABtcToDestChain] Processing record ${currentIndex} of ${totalRecords} for chain ${chainId}: bridging with txn hash ${txnHash}`);
            
            try {
              if (bridging.verified_count < chainConfig.validators_threshold) {
                throw new Error(`Verified count is less than validators threshold: ${bridging.verified_count} < ${chainConfig.validators_threshold}`);
              }

              if (!address.isValidEthereumAddress(bridging.dest_chain_address)) {
                throw new Error(`Invalid destination address: ${bridging.dest_chain_address}`);
              }

              // Find the event with matching transaction hash
              const matchingEvent = events.find(event => 
                event.args.originTxnHash.toLowerCase() === txnHash.split(",")[1].toLowerCase()
              );
  
              if (matchingEvent) {
                const evmTransactionHash = matchingEvent.transactionHash;
                console.log(`Event found for txn hash ${txnHash}: EVM transaction hash ${evmTransactionHash}`);
                // Update the bridging record with the EVM transaction hash
                
                await near.updateBridgingMintedTxnHash(txnHash, evmTransactionHash);
                await updateOffchainBridgingMintedTxnHash(
                  allBridgings,
                  txnHash,
                  evmTransactionHash
                );
                await updateOffchainBridgingStatus(
                  allBridgings,
                  txnHash,
                  BRIDGING_STATUS.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST
                );
                continue;
              } else {
                console.log(`No event found for txn hash ${txnHash}`);
              }

              console.log(`${batchName} Processing EVM Chain signatures`);
              console.log(`${batchName} Minter and sender address: ${sender}`);

              // Create payload to deploy the contract
              console.log(`${batchName} Creating EVM and Sign payload...`);
              console.log(`${batchName} Bridge record: ${JSON.stringify(bridging)}`);
              const finalAbtcAmount = bridging.abtc_amount - bridging.bridging_gas_fee_sat - bridging.protocol_fee - bridging.minting_fee_sat;
              console.log(`${batchName} Final aBTC amount: ${finalAbtcAmount}`);
              
              const { nonce, signed } = await ethereum.createMintBridgeABtcSignedTx(
                near,
                txnHash,
                sender,
                bridging.dest_chain_address,
                Number(finalAbtcAmount),
                bridging.origin_chain_id,
                bridging.origin_chain_address,
                bridging.txn_hash.split(",")[1],
                bridging.minting_fee_sat,
              );

              // Check if signedTransaction is an empty Uint8Array
              if (signed.length === 0) {
                console.error("Signed transaction is empty. Aborting process.");
                return;
              }

              // Relay the transaction to EVM
              console.log(`${batchName} Relay transaction to EVM...`);

              const { txnHash: evmTxnHash, status } = await ethereum.relayTransaction(nonce, sender, signed);
              
              console.log(
                "\x1b[35m%s\x1b[0m",
                `${batchName} Processed Txn: Bridge aBTC with txn hash ${txnHash}, bridgeStatus = ${status}`,
              );

              await updateOffchainBridgingStatus(
                allBridgings,
                txnHash,
                BRIDGING_STATUS.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST
              );

              if (status === false) {
                let remarks = `Error ${batchName} processing Txn with txn hash ${txnHash}: Transaction relayer return with error`;
                console.error(remarks);
                await near.updateBridgingRemarks(txnHash, remarks);
                await updateOffchainBridgingRemarks(
                  allBridgings,
                  txnHash,
                  remarks
                );
              }
            } catch (error) {
              let remarks = `Error ${batchName} processing Txn with txn hash ${txnHash}: ${error}`;
              console.error(remarks);
              if (!error.message.includes("Gas price is less than base fee per gas")) {
                await near.updateBridgingRemarks(txnHash, remarks);
                await updateOffchainBridgingRemarks(
                  allBridgings,
                  txnHash,
                  remarks
                );
              }
              continue;
            }
          }
        } else if (chainConfig.networkType === NETWORK_TYPE.NEAR) {
          console.log(`Starting NEAR chain processing for chain ${chainId}`);
          let totalRecords = chainTransactions.length;
          let currentIndex = 0;

          for (const bridging of chainTransactions) {
            const txnHash = bridging.txn_hash;
            currentIndex++;

            if (currentIndex % RECORDS_BEFORE_PAUSE === 0) {
              console.log(`[mintBridgeABtcToDestChain] Pausing for ${RECORDS_BEFORE_PAUSE} records...`);
              await new Promise(resolve => setTimeout(resolve, 10000));
            }
            
            console.log(`[mintBridgeABtcToDestChain] Processing record ${currentIndex} of ${totalRecords} for chain ${chainId}: bridging with txn hash ${txnHash}`);
            
            try {
              console.log("Processing NEAR Chain signatures");

              if (!address.isValidNearAddress(bridging.dest_chain_address)) {
                throw new Error(
                  `Invalid destination address: ${bridging.dest_chain_address}`,
                );
              }
              
              const payloadHeader = {
                txn_hash: txnHash,
                nonce: 0,
                gas: GAS_FOR_MINT_CALL,
                max_fee_per_gas: 0,
                max_priority_fee_per_gas: 0,
              };

              // Create payload to deploy the contract
              console.log(`Bridging aBTC on NEAR...`);
              const { nonce, signed } = await near.createMintBridgeABtcSignedTx(payloadHeader);

              console.log(signed);

              await updateOffchainBridgingStatus(
                allBridgings,
                txnHash,
                BRIDGING_STATUS.ABTC_PENDING_BRIDGE_FROM_ORIGIN_TO_DEST
              );

            } catch (error) {
              let remarks = `Error ${batchName} processing Txn with txn hash ${txnHash}: ${error}`;
              console.error(remarks);
              if (!error.message.includes("Gas price is less than base fee per gas")) {
                await near.updateBridgingRemarks(txnHash, remarks);
                await updateOffchainBridgingRemarks(
                  allBridgings,
                  txnHash,
                  remarks
                );
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
      flagsBatch.BridgeaBtcToDestChainRunning = false;
    }
  }
}

module.exports = { MintBridgeABtcToDestChain };