import { useQuery } from "@tanstack/react-query";

import { ChainConfig } from "@/app/types/chainConfig";
import { getEstimateAbtcBurnGas } from "@/utils/getEstimateAbtcBurnGas";
import { getTxRedemptionFees } from "@/utils/getTxRedemptionFees";
import { getTxBridgingFees } from "@/utils/getTxBridgingFees";

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

export function useGetBridgeFee({
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
      "TxBridgingFees",
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

      const fees = await getTxBridgingFees(amountSat);

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
          networkType: chainConfig?.networkType,
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

      const { gasEstimate, gasPrice, gasLimit, success } = await getEstimateAbtcBurnGas(
        chainConfig.chainRpcUrl,
        chainConfig.aBTCAddress,
        userAddress,
        amountSat,
        userAddress,
        chainConfig.networkType
      );

      if (success) {
        return {
          gasPrice,
          gasEstimate,
          gasLimit
        };
      }

      return null;
    },
    enabled: !!chainConfig && !!userAddress && !!amountSat,
  });
}
