import { useCallback } from "react";
import { useWriteContract } from "wagmi";

export const abi = [
  {
    name: "burnBridge",
    type: "function",
    outputs: [],
    stateMutability: "nonpayable",
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "destChainId",
        type: "string",
      },
      {
        internalType: "string",
        name: "destChainAddress",
        type: "string",
      },
    ],
  },
] as const;

export interface UseBridgeOptions {
  tokenAddress?: string;
}

export function useABtcBridge({ tokenAddress }: UseBridgeOptions) {
  const { writeContractAsync, writeContract, ...others } = useWriteContract();

  const mutateAsync = useCallback(
    async ({
      amount,
      destChainId,
      destChainAddress,
    }: {
      amount: string;
      destChainId: string;
      destChainAddress: string;
    }) => {
      if (!tokenAddress) {
        throw new Error("tokenAddress is required");
      }

      if (amount === undefined) {
        throw new Error("amount is required");
      }

      if (!destChainId) {
        throw new Error("destChainId is required");
      }

      if (!destChainAddress) {
        throw new Error("destChainAddress is required");
      }

      return writeContractAsync({
        abi: abi,
        address: tokenAddress as any,
        functionName: "burnBridge" as const,
        args: [BigInt(amount), destChainId, destChainAddress],
      });
    },
    [writeContractAsync, tokenAddress],
  );

  return {
    ...others,
    mutateAsync,
  };
}
