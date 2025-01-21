import { useInfiniteQuery } from "@tanstack/react-query";

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

export function useGetStakingHistory({
  address,
  publicKeyNoCoord,
  isErrorOpen,
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
    retry: (failureCount, error) => {
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
    retry: (failureCount, error) => {
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
    retry: (failureCount, error) => {
      return failureCount <= 3;
    },
  });
}
