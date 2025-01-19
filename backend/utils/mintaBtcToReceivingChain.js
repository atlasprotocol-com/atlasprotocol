const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");

const { flagsBatch } = require("./batchFlags");

const GAS_FOR_MINT_CALL = 100; // Gas for minting call

async function MintaBtcToReceivingChain(near) {
  const batchName = `Batch D MintaBtcToReceivingChain`;

  if (flagsBatch.MintaBtcToReceivingChainRunning) {
    return;
  } else {
    try {
      console.log(`${batchName}. Start run ...`);
      flagsBatch.MintaBtcToReceivingChainRunning = true;

      const { NETWORK_TYPE } = getConstants(); // Access constants dynamically

      // Get the first valid deposit and associated chain config using near.getFirstValidDepositChainConfig
      const result = await near.getFirstValidDepositChainConfig();

      // Check if the result is null or undefined
      if (!result) {
        console.log("No valid deposit or chain config found.");
        return;
      }

      // Destructure the result if it's valid
      const [btcTxnHash, chainConfig] = result;
      // console.log(`BTC Transaction Hash: ${btcTxnHash}`);
      // console.log(`Chain Config:`, chainConfig);

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
            btcTxnHash,
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
            `Processed Txn: Mint aBTC with BTC txn hash ${btcTxnHash}, mintStatus = ${status} and txnHash = ${txnHash}`,
          );

          if (status !== 1n) {
            let remarks = `Error ${batchName} processing Txn with BTC txn hash ${btcTxnHash}: ${txnHash} return with error`;
            console.error(remarks);
            await near.updateDepositRemarks(btcTxnHash, remarks);
          }
        } else if (chainConfig.network_type === "NEAR") {
          const payloadHeader = {
            btc_txn_hash: btcTxnHash,
            nonce: 0,
            gas: GAS_FOR_MINT_CALL,
            max_fee_per_gas: 0,
            max_priority_fee_per_gas: 0,
          };

          // Create payload to deploy the contract
          console.log(`Minting aBTC on NEAR...`);
          const signedTransaction =
            await near.createMintaBtcSignedTx(payloadHeader);

          console.log(signedTransaction);
        }
      } catch (error) {
        let remarks = `Error ${batchName} processing Txn with BTC txn hash ${btcTxnHash}: ${error} - ${error.reason}`;

        console.error(remarks);

        await near.updateDepositRemarks(btcTxnHash, remarks);

        return;
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
