import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { Stakes } from "@/app/types/stakes";

import {
  getBridgeHistories,
  PaginatedBridgeHistories,
} from "../api/getBridgeHistory";
import {
  getRedemptionHistories,
  PaginatedRedemptionHistories,
} from "../api/getRedemptionHistories";
import {
  getStakingHistories,
  PaginatedStakingHistories,
} from "../api/getStakingHistories";
import { retryTransaction } from "../api/retry";
import { useAppContext } from "../context/app";

export function useGetStakingHistory({
  address,
  publicKeyNoCoord,
}: {
  address?: string;
  publicKeyNoCoord?: string;
  isErrorOpen?: boolean;
}) {
  return useInfiniteQuery({
    queryKey: ["stakingHistories", address, publicKeyNoCoord],
    queryFn: ({ pageParam = "" }) => getStakingHistories(pageParam, address),
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.next_key !== ""
        ? lastPage?.pagination?.next_key
        : null,
    initialPageParam: "",
    refetchInterval: 60000,
    enabled: !!(publicKeyNoCoord && address),
    select: (data) => {
      const flattenedData = data.pages.reduce<PaginatedStakingHistories>(
        (acc, page) => {
          acc.stakingHistories.push(...page.stakingHistories);
          acc.pagination = page.pagination;
          return acc;
        },
        { stakingHistories: [], pagination: { next_key: "" } },
      );

      return flattenedData;
    },
    retry: (failureCount) => {
      return failureCount <= 3;
    },
  });
}

export function useGetRedemptionHistory({
  address,
  publicKeyNoCoord,
  isErrorOpen,
}: {
  address?: string;
  publicKeyNoCoord?: string;
  isErrorOpen?: boolean;
}) {
  return useInfiniteQuery({
    queryKey: ["redemptionHistories", address, publicKeyNoCoord],
    queryFn: ({ pageParam = "" }) => getRedemptionHistories(pageParam, address),
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.next_key !== ""
        ? lastPage?.pagination?.next_key
        : null,
    initialPageParam: "",
    refetchInterval: 60000,
    enabled: !!(publicKeyNoCoord && address),
    select: (data) => {
      const flattenedData = data.pages.reduce<PaginatedRedemptionHistories>(
        (acc, page) => {
          acc.redemptionHistories.push(...page.redemptionHistories);
          acc.pagination = page.pagination;
          return acc;
        },
        { redemptionHistories: [], pagination: { next_key: "" } },
      );

      return flattenedData;
    },
    retry: (failureCount) => {
      return !isErrorOpen && failureCount <= 3;
    },
  });
}

export function useGetBridgeHistory({ address }: { address?: string }) {
  return useInfiniteQuery({
    queryKey: ["bridgeHistories", address],
    queryFn: ({ pageParam = "" }) =>
      getBridgeHistories(address || "", pageParam),
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.next_key !== ""
        ? lastPage?.pagination?.next_key
        : null,
    initialPageParam: "",
    refetchInterval: 60000,
    enabled: !!address,
    select: (data) => {
      const flattenedData = data.pages.reduce<PaginatedBridgeHistories>(
        (acc, page) => {
          acc.bridgeHistory.push(...page.bridgeHistories);
          acc.pagination = page.pagination;
          return acc;
        },
        { bridgeHistory: [], pagination: { next_key: "" } },
      );

      return flattenedData;
    },
    retry: (failureCount) => {
      return failureCount <= 3;
    },
  });
}

export function useRetryTransaction() {
  const { btcWallet } = useAppContext();

  async function withDrawFailedDeposit(stakingHistory: Stakes) {
    const publicKey = await btcWallet?.getPublicKeyHex();
    const address = await btcWallet?.getAddress();
    const message = [address, stakingHistory.btcTxnHash].join(",");
    const signature = await btcWallet?.signMessageBIP322(message);
    const data = {
      id: btcWallet?.id,
      publicKey,
      address,
      btcTxnHash: stakingHistory.btcTxnHash,
      message,
      signature,
    };
    return data;
  }

  return useMutation({
    mutationFn: async (stakingHistory: Stakes) => {
      const data = await withDrawFailedDeposit(stakingHistory);
      await retryTransaction(data);
    },
    onSuccess: () => {
      toast.success("Transaction retried");
    },
    onError: (error) => {
      toast.error("Transaction retry failed");
      console.error(error);
    },
  });
}
