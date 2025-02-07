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

      const fees = await getTxRedemptionFees(amountSat);

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
          gasPrice: Math.ceil(gasPrice),
          gasEstimate: Math.ceil(gasEstimate),
        };
      }

      return null;
    },
    enabled: !!chainConfig && !!userAddress && !!amountSat,
  });
}
