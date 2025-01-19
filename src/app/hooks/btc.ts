import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAppContext } from "@/app/context/app";
import { satoshiToBtc } from "@/utils/btcConversions";
import { UTXO } from "@/utils/btcStaking";
import {
  createStakingTx,
  signStakingTx,
} from "@/utils/delegations/signStakingTx";
import { getFeeRateFromMempool } from "@/utils/getFeeRateFromMempool";
import { maxDecimals } from "@/utils/maxDecimals";

import { useGetGlobalParams } from "../../hooks/stats";
import { useAddFeedback } from "../stores/feedback";

export function useGetAccountUTXO() {
  const { btcAddress: address, btcWallet } = useAppContext();

  return useQuery({
    queryKey: ["btc", "utxos", address],
    queryFn: async () => {
      if (btcWallet?.getUtxos && address) {
        const data = await btcWallet.getUtxos(address);
        return data;
      }
    },
    enabled: !!(btcWallet?.getUtxos && address),
    refetchInterval: 60000 * 5, // 5 minutes
    retry: (failureCount) => {
      return failureCount <= 3;
    },
  });
}

export function useGetMempoolFeeRate() {
  const { btcWallet } = useAppContext();

  const { data, ...others } = useQuery({
    queryKey: ["btc", "mempoolFeeRate"],
    queryFn: async () => {
      if (btcWallet?.getNetworkFees) {
        return await btcWallet.getNetworkFees();
      }
    },
    enabled: !!btcWallet?.getNetworkFees,
    refetchInterval: 60000, // 1 minute
    retry: (failureCount) => {
      return failureCount <= 3;
    },
  });

  const feeRates = useMemo(() => {
    if (!data) return undefined;
    return getFeeRateFromMempool(data);
  }, [data]);

  return {
    ...others,
    data: data
      ? {
          ...data,
          feeRates,
        }
      : undefined,
  };
}

export function useGetStakingFee({
  stakingAmountSat,
  feeRate,
  inputUTXOs,
  receivingChainID,
  receivingAddress,
}: {
  stakingAmountSat?: number;
  feeRate?: number;
  inputUTXOs?: UTXO[];
  receivingChainID?: string;
  receivingAddress?: string;
}) {
  const { btcNetwork, btcAddress, btcPublicKeyNoCoord } = useAppContext();
  const { data: params } = useGetGlobalParams();

  return useMemo(() => {
    const atlasAddress = params?.atlasAddress;

    if (
      !atlasAddress ||
      !btcNetwork ||
      !btcAddress ||
      !btcPublicKeyNoCoord ||
      !stakingAmountSat ||
      !feeRate ||
      !inputUTXOs ||
      !inputUTXOs.length
    ) {
      return undefined;
    }

    const { stakingFeeSat } = createStakingTx(
      stakingAmountSat,
      atlasAddress,
      btcNetwork,
      btcAddress,
      btcPublicKeyNoCoord,
      feeRate,
      inputUTXOs,
      `${receivingChainID},${receivingAddress}`,
    );

    return {
      amount: stakingFeeSat,
      formatted: maxDecimals(satoshiToBtc(stakingFeeSat), 8),
    };
  }, [
    btcAddress,
    btcNetwork,
    btcPublicKeyNoCoord,
    feeRate,
    inputUTXOs,
    params?.atlasAddress,
    receivingAddress,
    receivingChainID,
    stakingAmountSat,
  ]);
}

export function useSignStaking() {
  const {
    btcAddress: address,
    btcWallet,
    btcNetwork,
    btcPublicKeyNoCoord,
  } = useAppContext();

  const { data: globalParams } = useGetGlobalParams();

  const { addFeedback } = useAddFeedback();

  const handleSign = async (data: {
    stakingAmountSat: number;
    feeRate: number;
    availableUTXOs: UTXO[];
    stakingReceivingChainID: string;
    stakingReceivingAddress: string;
  }) => {
    const {
      stakingAmountSat,
      feeRate,
      availableUTXOs,
      stakingReceivingChainID,
      stakingReceivingAddress,
    } = data;
    if (!btcWallet) throw new Error("Wallet is not connected");
    if (!address) throw new Error("Address is not set");
    if (!btcNetwork) throw new Error("Wallet network is not connected");
    if (!btcPublicKeyNoCoord) throw new Error("Public key not set");

    if (!globalParams?.atlasAddress) {
      throw new Error("Global param no loaded.");
    }

    const { txHash } = await signStakingTx(
      btcWallet,
      stakingAmountSat,
      globalParams.atlasAddress,
      btcNetwork,
      address,
      btcPublicKeyNoCoord,
      feeRate,
      availableUTXOs,
      `${stakingReceivingChainID},${stakingReceivingAddress}`,
    );
    console.log("Staking tx hex", txHash);
    return txHash;
  };

  return useMutation({
    mutationFn: handleSign,
  });
}
