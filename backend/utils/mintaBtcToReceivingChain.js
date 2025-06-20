const { getConstants } = require("../constants");
const { Ethereum } = require("../services/ethereum");
const address = require("../services/address");
const {
  updateOffchainDepositStatus,
  updateOffchainDepositRemarks,
  getDepositsToBeMinted,
} = require("../helpers/depositsHelper");
const {
  getTxnHashByOriginTxnHashMinted,
} = require("../helpers/atbtcEventsHelper");

const { getBlockCursor } = require("./batchTime/lastScannedBlockHelper");
const { flagsBatch } = require("./batchFlags");
const { getChainConfig } = require("./network.chain.config");

const RECORDS_BEFORE_PAUSE = 10;

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
      const filteredTxns = await getDepositsToBeMinted(allDeposits);

      if (filteredTxns.length === 0) {
        console.log(`${batchName} No deposits to process.`);
        return;
      }

      console.log(
        "[mintAtbtcToReceivingChain] records to mint to atBTC: ",
        filteredTxns.length,
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
      for (const [chainId, chainTransactions] of Object.entries(
        transactionsByChain,
      )) {
        console.log(
          `Processing ${chainTransactions.length} transactions for chain ${chainId}`,
        );

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

          let totalRecords = chainTransactions.length;
          let currentIndex = 0;

          console.log(`Processing EVM Chain signatures`);

          for (const depositRecord of chainTransactions) {
            const btcTxnHash = depositRecord.btc_txn_hash;
            currentIndex++;

            const onChainDeposit =
              await near.getDepositByBtcTxnHash(btcTxnHash);
            if (
              onChainDeposit.status !==
              DEPOSIT_STATUS.BTC_YIELD_PROVIDER_DEPOSITED
            ) {
              console.log(
                `[mintAtbtcToReceivingChain] BTC transaction ${btcTxnHash} is not in the correct status, skipping...`,
              );
              continue;
            }

            // Check if BTC transaction hash already exists in atbtc events
            const mintedTxnHash =
              await getTxnHashByOriginTxnHashMinted(btcTxnHash);
            if (mintedTxnHash) {
              await near.updateDepositMintedTxnHash(btcTxnHash, mintedTxnHash);
              await updateOffchainDepositMintedTxnHash(
                allDeposits,
                btcTxnHash,
                DEPOSIT_STATUS.BTC_MINTED_INTO_ABTC,
                mintedTxnHash,
              );
              console.log(
                `[mintAtbtcToReceivingChain] BTC transaction ${btcTxnHash} has already been minted, updating status to ${DEPOSIT_STATUS.BTC_MINTED_INTO_ABTC}`,
              );
              continue;
            }
            if (currentIndex % RECORDS_BEFORE_PAUSE === 0) {
              console.log(
                `[mintBridgeABtcToDestChain] Pausing for ${RECORDS_BEFORE_PAUSE} records...`,
              );
              await new Promise((resolve) => setTimeout(resolve, 10000));
            }

            console.log(
              `[mintAtbtcToReceivingChain] Processing record ${currentIndex} of ${totalRecords} for chain ${chainId}: minting with BTC txn hash ${btcTxnHash}`,
            );
            try {
              console.log(`Minter and sender address: ${sender}`);

              // Create payload to deploy the contract
              console.log(`Creating EVM and Sign payload...`);
              const { nonce, signed } = await ethereum.createMintaBtcSignedTx(
                near,
                sender,
                depositRecord.receiving_address,
                depositRecord.btc_amount -
                  depositRecord.yield_provider_gas_fee -
                  depositRecord.minting_fee -
                  depositRecord.protocol_fee,
                btcTxnHash,
                depositRecord.minting_fee,
              );

              // Check if signedTransaction is an empty Uint8Array
              if (signed.length === 0) {
                console.error("Signed transaction is empty. Aborting process.");
                return;
              }

              // Relay the transaction to EVM
              console.log(`Relay transaction to EVM...`);

              const { txnHash, status } = await ethereum.relayTransaction(
                nonce,
                sender,
                signed,
              );
              console.log(
                "\x1b[35m%s\x1b[0m",
                `Processed Txn: Mint aBTC with BTC txn hash ${btcTxnHash}, mintStatus = ${status}`,
              );
            } catch (error) {
              let remarks = `Error ${batchName} processing Txn with BTC txn hash ${btcTxnHash}: ${error}`;
              console.error(remarks);
              if (
                !error.message.includes(
                  "Gas price is less than base fee per gas",
                )
              ) {
                await near.updateDepositRemarks(btcTxnHash, remarks);
                await updateOffchainDepositRemarks(
                  allDeposits,
                  btcTxnHash,
                  remarks,
                );
              }
              continue;
            }
          }
        } else if (chainConfig.networkType === NETWORK_TYPE.NEAR) {
          console.log(`Starting NEAR chain processing for chain ${chainId}`);

          // Get current block number to check if chain is too far behind
          const endBlock = await near.getCurrentBlockNumber();
          const startBlock = await getBlockCursor(
            "NearChainScanner",
            chainId + "_NearChainScanner",
            endBlock,
          );

          // Skip processing if too far behind
          if (startBlock < endBlock - 50) {
            console.log(
              `NEAR chain ${chainId} is too far behind (start: ${startBlock}, current: ${endBlock}). Skipping processing.`,
            );
            continue;
          }

          let totalRecords = chainTransactions.length;
          let currentIndex = 0;

          for (const depositRecord of chainTransactions) {
            const btcTxnHash = depositRecord.btc_txn_hash;
            currentIndex++;

            const onChainDeposit =
              await near.getDepositByBtcTxnHash(btcTxnHash);
            if (
              onChainDeposit.status !==
              DEPOSIT_STATUS.BTC_YIELD_PROVIDER_DEPOSITED
            ) {
              console.log(
                `[mintAtbtcToReceivingChain] BTC transaction ${btcTxnHash} is not in the correct status, skipping...`,
              );
              continue;
            }

            // Check if BTC transaction hash already exists in atbtc events
            const mintedTxnHash =
              await getTxnHashByOriginTxnHashMinted(btcTxnHash);
            if (mintedTxnHash) {
              await near.updateDepositMintedTxnHash(btcTxnHash, mintedTxnHash);
              await updateOffchainDepositStatus(
                allDeposits,
                btcTxnHash,
                DEPOSIT_STATUS.BTC_MINTED_INTO_ABTC,
              );
              console.log(
                `[mintAtbtcToReceivingChain] BTC transaction ${btcTxnHash} has already been minted, updating status to ${DEPOSIT_STATUS.BTC_MINTED_INTO_ABTC}`,
              );
              continue;
            }

            if (currentIndex % RECORDS_BEFORE_PAUSE === 0) {
              console.log(
                `[mintBridgeABtcToDestChain] Pausing for ${RECORDS_BEFORE_PAUSE} records...`,
              );
              await new Promise((resolve) => setTimeout(resolve, 10000));
            }

            console.log(
              `[mintAtbtcToReceivingChain] Processing record ${currentIndex} of ${totalRecords} for chain ${chainId}: minting with BTC txn hash ${btcTxnHash}`,
            );

            try {
              console.log("Processing NEAR Chain signatures");

              if (
                !address.isValidNearAddress(depositRecord.receiving_address)
              ) {
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

              // Create payload to deploy the contract
              console.log(`Minting aBTC on NEAR...`);
              const signedTransaction =
                await near.createMintaBtcSignedTx(payloadHeader);

              console.log(signedTransaction);
            } catch (error) {
              let remarks = `Error ${batchName} processing Txn with BTC txn hash ${btcTxnHash}: ${error}`;
              console.error(remarks);
              if (
                !error.message.includes(
                  "Gas price is less than base fee per gas",
                )
              ) {
                await near.updateDepositRemarks(btcTxnHash, remarks);
                await updateOffchainDepositRemarks(
                  allDeposits,
                  btcTxnHash,
                  remarks,
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
      flagsBatch.MintaBtcToReceivingChainRunning = false;
    }
  }
}

module.exports = { MintaBtcToReceivingChain };
