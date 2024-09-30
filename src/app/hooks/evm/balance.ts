import { useMemo } from "react";
import { formatUnits } from "viem";
import { useAccount, useReadContracts } from "wagmi";

const contract = {
  abi: [
    {
      type: "function",
      name: "balanceOf",
      stateMutability: "view",
      inputs: [{ type: "address" }],
      outputs: [{ type: "uint256" }],
    },
    {
      type: "function",
      name: "decimals",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint8" }],
    },
    {
      type: "function",
      name: "symbol",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "string" }],
    },
  ],
} as const;

export interface UseTokenBalanceOptions {
  tokenAddress?: string;
  chainId?: number;
}

export function useTokenBalance({
  tokenAddress,
  chainId,
}: UseTokenBalanceOptions) {
  const account = useAccount();

  const chainIdToUse = chainId ?? account.chainId;

  const { data, ...rest } = useReadContracts({
    query: {
      enabled: account.isConnected && !!tokenAddress,
      refetchInterval: 10000,
    },
    allowFailure: false,
    contracts: [
      {
        ...contract,
        functionName: "balanceOf",
        args: [account.address as any],
        chainId: chainIdToUse,
        address: tokenAddress as any,
      },
      {
        ...contract,
        functionName: "decimals",
        chainId: chainIdToUse,
        address: tokenAddress as any,
      },
      {
        ...contract,
        functionName: "symbol",
        chainId: chainIdToUse,
        address: tokenAddress as any,
      },
    ],
  });

  const formatted = useMemo(() => {
    if (data) {
      const [value, decimals, symbol] = data;
      const formatted = formatUnits(value ?? "0", decimals);
      return { decimals, formatted, symbol, value };
    }
  }, [data]);

  return {
    data: formatted,
    ...rest,
  };
}