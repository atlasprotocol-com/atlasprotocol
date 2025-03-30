const CoboWaas2 = require("@cobo/cobo-waas2");

async function runCoboIntegration(transactionHash, near) {
  try {
    // Get deposit records using near.getDepositByBtcTxnHash
    console.log(transactionHash);
    const redemptionRecords =
      await near.getRedemptionByTxnHash(transactionHash);

    // Initial default API client
    const apiClient = CoboWaas2.ApiClient.instance;

    if (process.env.COBO_ENV === "DEV") {
      apiClient.setEnv(CoboWaas2.Env.DEV);
    } else {
      apiClient.setEnv(CoboWaas2.Env.PROD);
    }

    // Set your private key for signing requests (be sure to keep this secure)
    apiClient.setPrivateKey(process.env.COBO_PK);

    // Create an instance of the Transactions API
    const apiInstance = new CoboWaas2.TransactionsApi();

    const request_id = redemptionRecords.txn_hash;
    // Step 1: Estimate the Fee
    const optsEstimateFee = {
      EstimateFeeParams: new CoboWaas2.EstimateFeeParams({
        request_id: request_id,
        request_type: "Transfer",
        source: {
          source_type: "Org-Controlled",
          wallet_id: process.env.COBO_WALLET_ID,
        },
        destination: {
          destination_type: "Address",
          uxto_outputs: [
            {
              address: redemptionRecords.btc_receiving_address,
              amount: (redemptionRecords.abtc_amount / 100000000).toString(), // Amount in BTC for estimation
            },
          ],
        },
        token_id: "SIGNET_BTC",
      }),
    };

    // Call the API to estimate fees
    const feeResponse = await apiInstance.estimateFee(optsEstimateFee);
    const recommendedFee = feeResponse.actualInstance.recommended;
    const feeAmount = parseFloat(recommendedFee.fee_amount);

    // Convert the fee amount to satoshis
    const feeInSatoshis = Math.round(feeAmount * 100000000); // Convert BTC to Satoshis
    console.log(`Estimated fee in satoshis: ${feeInSatoshis}`);

    // Step 2: Subtract the Fee from the Redemption Amount
    const transferAmount = redemptionRecords.abtc_amount - feeInSatoshis; // Final amount after fee deduction
    if (transferAmount <= 0) {
      throw new Error("Transfer amount is too low after deducting the fee.");
    }

    // Step 3: Create Transfer Transaction
    const opts = {
      TransferParams: new CoboWaas2.TransferParams(
        request_id,
        {
          source_type: "Org-Controlled",
          wallet_id: process.env.COBO_WALLET_ID, // Source wallet ID Asset
          address: process.env.COBO_DEPOSIT_ADDRESS,
        },
        "SIGNET_BTC", // The network you are transacting on (SIGNET_BTC for Bitcoin testnet)
        {
          destination_type: "Address",
          account_output: {
            address: redemptionRecords.btc_receiving_address, // Destination address for Bitcoin transfer
            amount: (transferAmount / 100000000).toString(), // Final amount to transfer in BTC
            memo:
              redemptionRecords.abtc_redemption_chain_id +
              "," +
              redemptionRecords.abtc_redemption_address,
          },
        },
      ),
    };

    // Step 4: Execute the Transfer Transaction
    await apiInstance.createTransferTransaction(opts).then(
      async (data) => {
        console.log("API called successfully. Returned data: ");
        console.log(data);

        if (data.status === "Submitted") {
          await near.updateRedemptionCustodyTxnId(
            transactionHash,
            data.transaction_id,
          );
        } else {
          await near.updateRedemptionRemarks(
            transactionHash,
            `Error processing cobo txn`,
          );
        }
      },
      async (error) => {
        console.error("Error calling API:", error);
        await near.updateRedemptionRemarks(
          transactionHash,
          `Error processing txn: ${error.body.error_message}`,
        );
      },
    );

    await near.updateRedemptionStart(transactionHash);
  } catch (error) {
    console.error("Error in runCoboIntegration:", error);
    await near.updateRedemptionRemarks(
      transactionHash,
      `Error processing txn: ${error.message}`,
    );
  }
}

async function handleCoboTransaction(custodyTxnId) {
  try {
    console.log("custodyTxnId: ");
    console.log(custodyTxnId);
    // Initialize the Cobo API client
    const apiClient = CoboWaas2.ApiClient.instance;

    // Select the environment (DEV or PROD based on your use case)
    if (process.env.COBO_ENV === "DEV") {
      apiClient.setEnv(CoboWaas2.Env.DEV);
    } else {
      apiClient.setEnv(CoboWaas2.Env.PROD);
    }

    // Set the private key for signing requests
    apiClient.setPrivateKey(process.env.COBO_PK);

    // Create an instance of the Transactions API
    const apiInstance = new CoboWaas2.TransactionsApi();

    const data = await apiInstance.getTransactionById(custodyTxnId);

    // Initialize variables to store results
    let btcTxnHash = null;
    let timestamp = null;
    let hasConfirmed = false;

    // Check the status of Broadcasting
    const broadcastingStatus = data.timeline.find(
      (status) => status.status === "Broadcasting",
    );
    const completedStatus = data.timeline.find(
      (status) => status.status === "Completed",
    );

    const rejectedStatus = data.timeline.find(
      (status) => status.status === "Rejected",
    );

    // Throw an error if the transaction status is "Rejected"
    if (rejectedStatus && rejectedStatus.finished) {
      throw new Error(`Transaction ${custodyTxnId} was rejected.`);
    }

    // Logic for setting btcTxnHash and hasConfirmed based on statuses
    if (broadcastingStatus && broadcastingStatus.finished) {
      btcTxnHash = data.transaction_hash; // Set the btcTxnHash if Broadcasting is true
      timestamp = broadcastingStatus.finished_timestamp / 1000; // Set timestamp from Broadcasting event

      // If Broadcasting is true and Completed is true, hasConfirmed is true
      if (completedStatus && completedStatus.finished) {
        hasConfirmed = true;
      }
      // If Broadcasting is true and Completed is false, hasConfirmed remains false
    }

    // Return the extracted values
    return { btcTxnHash, timestamp, hasConfirmed };
  } catch (error) {
    console.error(
      `Error fetching transaction from Cobo for txn id ${custodyTxnId}: `,
      error,
    );
    throw error; // Re-throw the error to handle it upstream
  }
}

async function runWithdrawFailDepositCoboIntegration(btcTransactionHash, near) {
  const deposit = await near.getDepositByBtcTxnHash(btcTransactionHash);
  if (!deposit) {
    throw new Error("Deposit not found");
  }

  // Initial default API client
  const apiClient = CoboWaas2.ApiClient.instance;

  if (process.env.COBO_ENV === "DEV") {
    apiClient.setEnv(CoboWaas2.Env.DEV);
  } else {
    apiClient.setEnv(CoboWaas2.Env.PROD);
  }

  console.log(process.env.COBO_PK);
  // Set your private key for signing requests (be sure to keep this secure)
  apiClient.setPrivateKey(process.env.COBO_PK);

  // Create an instance of the Transactions API
  const apiInstance = new CoboWaas2.TransactionsApi();

  const request_id = deposit.btc_txn_hash;
  // Step 1: Estimate the Fee
  const optsEstimateFee = {
    EstimateFeeParams: new CoboWaas2.EstimateFeeParams({
      request_id: request_id,
      request_type: "Transfer",
      source: {
        source_type: "Org-Controlled",
        wallet_id: process.env.COBO_WALLET_ID,
      },
      destination: {
        destination_type: "Address",
        uxto_outputs: [
          {
            address: deposit.btc_sender_address,
            amount: (deposit.btc_amount / 100000000).toString(), // Amount in BTC for estimation
          },
        ],
      },
      token_id: "SIGNET_BTC",
    }),
  };

  // Call the API to estimate fees
  const feeResponse = await apiInstance.estimateFee(optsEstimateFee);
  const recommendedFee = feeResponse.actualInstance.recommended;
  const feeAmount = parseFloat(recommendedFee.fee_amount);

  // Convert the fee amount to satoshis
  const feeInSatoshis = Math.round(feeAmount * 100000000); // Convert BTC to Satoshis
  console.log(`Estimated fee in satoshis: ${feeInSatoshis}`);
  // Step 2: Subtract the Fee from the Redemption Amount
  const transferAmount = deposit.btc_amount - feeInSatoshis; // Final amount after fee deduction
  if (transferAmount <= 0) {
    throw new Error("Transfer amount is too low after deducting the fee.");
  }

  // Step 3: Create Transfer Transaction
  const opts = {
    TransferParams: new CoboWaas2.TransferParams(
      request_id,
      {
        source_type: "Org-Controlled",
        wallet_id: process.env.COBO_WALLET_ID, // Source wallet ID Asset
        address: process.env.COBO_DEPOSIT_ADDRESS,
      },
      "SIGNET_BTC", // The network you are transacting on (SIGNET_BTC for Bitcoin testnet)
      {
        destination_type: "Address",
        account_output: {
          address: deposit.btc_sender_address, // Destination address for Bitcoin transfer
          amount: (transferAmount / 100000000).toString(), // Final amount to transfer in BTC
          memo: deposit.btc_txn_hash,
        },
      },
    ),
  };

  // Step 4: Execute the Transfer Transaction
  await apiInstance.createTransferTransaction(opts).then(
    async (data) => {
      console.log("API called successfully. Returned data: ");
      console.log(data);

      if (data.status === "Submitted") {
        await near.updateDepositCustodyTxnId(
          deposit.btc_txn_hash,
          data.transaction_id,
        );
      } else {
        await near.updateDepositRemarks(
          deposit.btc_txn_hash,
          `Unable to run withdraw fail deposit: ${data.status}`,
        );
      }
    },
    async (error) => {
      console.error("Error calling API:", error);
      await near.updateDepositRemarks(
        deposit.btc_txn_hash,
        `Unable to run withdraw fail deposit: ${error.body.error_message}`,
      );
    },
  );
}

module.exports = {
  runCoboIntegration,
  handleCoboTransaction,
  runWithdrawFailDepositCoboIntegration,
};
