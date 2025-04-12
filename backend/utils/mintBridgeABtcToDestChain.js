const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { flagsBatch } = require("./batchFlags");

const GAS_FOR_MINT_CALL = 100; // Gas for minting call

const batchName = `Batch K BridgeaBtcToDestChain`;
async function MintBridgeABtcToDestChain(near) {
  if (flagsBatch.BridgeaBtcToDestChainRunning) {
    return;
  } else {
    try {
      console.log(`${batchName}. Start run ...`);
      flagsBatch.BridgeaBtcToDestChainRunning = true;

      const { NETWORK_TYPE } = getConstants(); // Access constants dynamically

      // Get the first valid bridging and associated chain config using near.getFirstValidDepositChainConfig
      const result = await near.getFirstValidBridgingChainConfig();

      // Check if the result is null or undefined
      if (!result) {
        console.log(`${batchName} No valid bridging or chain config found.`);
        return;
      }

      // Destructure the result if it's valid
      const [txnHash, chainConfig] = result;

      const bridgeRecord = await near.getBridgingByTxnHash(txnHash);

      try {
        if (chainConfig.network_type === NETWORK_TYPE.EVM) {
          const ethereum = new Ethereum(
            chainConfig.chain_id,
            chainConfig.chain_rpc_url,
            chainConfig.gas_limit,
            chainConfig.abtc_address,
            chainConfig.abi_path,
          );

          let derivationPath = chainConfig.network_type;

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
          const finalAbtcAmount = bridgeRecord.abtc_amount - bridgeRecord.yield_provider_gas_fee - bridgeRecord.protocol_fee - bridgeRecord.minting_fee_sat;
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
        } else if (chainConfig.network_type === NETWORK_TYPE.NEAR) {
          const payloadHeader = {
            txn_hash: txnHash,
            nonce: 0,
            gas: GAS_FOR_MINT_CALL,
            max_fee_per_gas: 0,
            max_priority_fee_per_gas: 0,
          };

          // NEAR is native supported chain so we will broadcast the transaction in the contract itself
          // so createMintBridgeABtcSignedTx return the result of mint_bridge function
          await near.createMintBridgeABtcSignedTx(payloadHeader);
        }
      } catch (error) {
        let remarks = `${batchName} Error: processing Txn with txn hash ${txnHash}: ${error} - ${error.reason}`;
        console.error(remarks);
        await near.updateBridgingRemarks(txnHash, remarks);

        return;
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
