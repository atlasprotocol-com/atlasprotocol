import { apiWrapper } from "./apiWrapper";

export const retryTransaction = async (data: {
  id: string | undefined;
  publicKey: string | undefined;
  address: string | undefined;
  btcTxnHash: string;
  message: string;
  signature: string | undefined;
}) => {
  await apiWrapper(
    "POST",
    "/api/v1/deposits/retry",
    "Error retrying transaction",
    data,
  );
};
