import { useQuery } from "@tanstack/react-query";

import { ChainConfig } from "@/app/types/chainConfig";
import { getEstimateAbtcBurnGas } from "@/utils/getEstimateAbtcBurnGas";
import { getTxRedemptionFees } from "@/utils/getTxRedemptionFees";

export function useGetRedeemFee({
  chainConfig,
  amountSat,
  userAddress,
}: {
  userAddress?: string;
  chainConfig?: ChainConfig;
  amountSat?: number;
}) {
  return useQuery({
    queryKey: [
      "TxRedemptionFees",
      {
        chainConfig: {
          chainID: chainConfig?.chainID,
          chainRpcUrl: chainConfig?.chainRpcUrl,
          aBTCAddress: chainConfig?.aBTCAddress,
        },
        userAddress,
        amountSat,
      },
    ],
    queryFn: async () => {
      if (!chainConfig || !userAddress || !amountSat) {
        throw new Error("Missing required parameters");
      }

      const fees = await getTxRedemptionFees(
        userAddress,
        amountSat,
        "0xDUMMY7f1e736d47dc5ef864f332b1155955ac3e8af7e219e24c11e6fd7dc9be7",
      );

      return fees;
    },
    enabled: !!chainConfig,
  });
}

export function useEstGasAtlasBurn({
  chainConfig,
  amountSat,
  userAddress,
}: {
  userAddress?: string;
  chainConfig?: ChainConfig;
  amountSat?: number;
}) {
  return useQuery({
    queryKey: [
      "estGasAtlasBurn",
      {
        chainConfig: {
          chainID: chainConfig?.chainID,
          chainRpcUrl: chainConfig?.chainRpcUrl,
          aBTCAddress: chainConfig?.aBTCAddress,
        },
        userAddress,
        amountSat,
      },
    ],
    queryFn: async () => {
      if (!chainConfig || !userAddress || !amountSat) {
        throw new Error("Missing required parameters");
      }

      console.log("Getting gas estimate for burning", amountSat, "aBTC");

      const { gasEstimate, gasPrice, success } = await getEstimateAbtcBurnGas(
        chainConfig.chainRpcUrl,
        chainConfig.aBTCAddress,
        userAddress,
        amountSat,
        userAddress,
      );

      if (success) {
        return {
          gasPrice: Math.ceil(gasPrice * 1.5),
          gasEstimate: Math.ceil(gasEstimate * 1.5),
        };
      }

      return null;
    },
    enabled: !!chainConfig && !!userAddress && !!amountSat,
  });
}
