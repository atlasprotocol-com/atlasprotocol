const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { getChainConfig } = require("./network.chain.config");
const { flagsBatch } = require("./batchFlags");

const GAS_FOR_MINT_CALL = 100; // Gas for minting call

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
        const allBridgingsToValidate = allBridgings.filter((bridging) => {
          try {
            const chainConfig = getChainConfig(bridging.dest_chain_id);
            
            return bridging.origin_chain_id !== "" &&
              bridging.origin_chain_address !== "" &&
              bridging.dest_chain_id !== "" &&
              bridging.dest_chain_address !== "" &&
              bridging.status === BRIDGING_STATUS.ABTC_BURNT &&
              bridging.remarks === "" &&
              bridging.verified_count >= chainConfig.validators_threshold;
          } catch (error) {
            const remarks = `Chain config not found for chain ID: ${bridging.dest_chain_id}`;
            console.log(remarks);
            return false;
          }
        });

      // Check if the result is null or undefined
      if (allBridgingsToValidate.length === 0) {
        console.log(`${batchName} No valid bridging or chain config found.`);
        return;
      }
      
      for (const bridging of allBridgingsToValidate) {  
        
        const txnHash = bridging.txn_hash;
        const chainConfig = getChainConfig(bridging.dest_chain_id);

        const bridgeRecord = await near.getBridgingByTxnHash(txnHash);
        console.log(`${batchName} : ${JSON.stringify(chainConfig)}`);

        if (bridgeRecord.status !== BRIDGING_STATUS.ABTC_BURNT) {
          console.log(`${batchName} Bridging record status is not ABTC_BURNT for txn hash: ${txnHash}`);
          continue;
        }

        try {
          if (chainConfig.networkType === NETWORK_TYPE.EVM) {
            const ethereum = new Ethereum(
              chainConfig.chainID,
              chainConfig.chainRpcUrl,
              chainConfig.gasLimit,
              chainConfig.aBTCAddress,
              chainConfig.abiPath,
            );
            
            let derivationPath = chainConfig.networkType;

            console.log(`${batchName} Processing EVM Chain signatures`);

            // Generate the derived address for the aBTC minter & sender
            const sender = await ethereum.deriveEthAddress(
              await near.nearMPCContract.public_key(),
              near.contract_id,
              derivationPath,
            );

            console.log(`${batchName} Minter and sender address: ${sender}`);

            // Create payload to deploy the contract
            console.log(`${batchName} Creating EVM and Sign payload...`);
            console.log(`${batchName} Bridge record: ${JSON.stringify(bridgeRecord)}`);
            const finalAbtcAmount = bridgeRecord.abtc_amount - bridgeRecord.bridging_gas_fee_sat - bridgeRecord.protocol_fee - bridgeRecord.minting_fee_sat;
            console.log(`${batchName} Final aBTC amount: ${finalAbtcAmount}`);
            const signedTransaction = await ethereum.createMintBridgeABtcSignedTx(
              near,
              txnHash,
              sender,
              bridgeRecord.dest_chain_address,
              Number(finalAbtcAmount),
              bridgeRecord.origin_chain_id,
              bridgeRecord.origin_chain_address,
              bridgeRecord.txn_hash.split(",")[1],
              bridgeRecord.minting_fee_sat,
            );
            // Relay the transaction to EVM
            console.log(`${batchName} Relay transaction to EVM...`);

            const r = await ethereum.relayTransaction(signedTransaction);
            console.log(
              `${batchName} Processed Txn: Mint aBTC with txn hash ${r.txnHash}, mintStatus = ${r.status}`,
            );

            if (r.status !== 1n) {
              let remarks = `Error processing Txn with txn hash ${txnHash}: ${r.txnHash} return with error`;
              console.error(`${batchName} ${remarks}`);
              await near.updateBridgingRemarks(txnHash, remarks);
            }
          } else if (chainConfig.networkType === NETWORK_TYPE.NEAR) {
            const payloadHeader = {
              txn_hash: txnHash,
              nonce: 0,
              gas: GAS_FOR_MINT_CALL,
              max_fee_per_gas: 0,
              max_priority_fee_per_gas: 0,
            };

            console.log(`${batchName} Creating NEAR and Sign payload...`);
            // NEAR is native supported chain so we will broadcast the transaction in the contract itself
            // so createMintBridgeABtcSignedTx return the result of mint_bridge function
            await near.createMintBridgeABtcSignedTx(payloadHeader);
          }
        } catch (error) {
          let remarks = `${batchName} Error: processing Txn with txn hash ${txnHash}: ${error} - ${error.reason}`;
          console.error(remarks);
          if (!error.message.includes("Gas price is less than base fee per gas")) {
            await near.updateBridgingRemarks(txnHash, remarks);
          }
          return;
        }
      }
      console.log(`${batchName} completed successfully.`);
    } catch (error) {
      console.error(`${batchName}:`, error);
    } finally {
      flagsBatch.BridgeaBtcToDestChainRunning = false;
    }
  }
}

module.exports = { MintBridgeABtcToDestChain };
