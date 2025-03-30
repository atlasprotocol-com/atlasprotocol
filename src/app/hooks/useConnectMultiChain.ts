import { useCallback, useContext, useEffect, useMemo } from "react";
import { useDisconnect, useSwitchChain } from "wagmi";

import { useCallbackRef } from "@/hooks";
import { useEvmWallet } from "@/utils/evm_wallet/wallet_provider";
import { NearContext, useNearTokenBalance } from "@/utils/near";

import { useAddFeedback } from "../stores/feedback";
import { ChainConfig } from "../types/chainConfig";

import { useTokenBalance } from "./evm";

export function useConnectMultiChain({
  selectedChain,
  onRequireEvmWallet,
}: {
  selectedChain?: ChainConfig | undefined;
  onRequireEvmWallet?: () => void;
}) {
  const { addFeedback } = useAddFeedback();

  const { evmAddress } = useEvmWallet();
  const { switchChainAsync } = useSwitchChain();
  const { disconnectAsync: rawDisconnectAsync, isPending: isDisconnecting } =
    useDisconnect();

  const { signedAccountId: nearAccountId, wallet: nearWallet } =
    useContext(NearContext);

  const address = useMemo(() => {
    if (selectedChain?.networkType === "EVM") {
      return evmAddress;
    } else if (selectedChain?.networkType === "NEAR") {
      return nearAccountId;
    }
    return undefined;
  }, [evmAddress, nearAccountId, selectedChain?.networkType]);

  const onRequireEvmWalletRef = useCallbackRef(onRequireEvmWallet);

  const handleChainChange = useCallback(
    async (chain: ChainConfig | undefined) => {
      if (!chain) {
        return;
      }

      try {
        if (chain.networkType === "EVM") {
          if (evmAddress) {
            await switchChainAsync({
              chainId: Number(chain.chainID || 0),
            });
          } else {
            onRequireEvmWalletRef?.();
          }
        } else if (chain.networkType === "NEAR" && !nearAccountId) {
          nearWallet?.signIn();
        }
      } catch (error: Error | any) {
        addFeedback({
          content: error.message,
          type: "error",
          onRetry: () => handleChainChange(chain),
        });
      }
    },
    [
      addFeedback,
      evmAddress,
      nearAccountId,
      nearWallet,
      onRequireEvmWalletRef,
      switchChainAsync,
    ],
  );

  useEffect(() => {
    handleChainChange(selectedChain);
  }, [handleChainChange, selectedChain]);

  const disconnectAsync = useCallback(async () => {
    if (selectedChain?.networkType === "EVM") {
      await rawDisconnectAsync();
    }
    if (selectedChain?.networkType === "NEAR") {
      nearWallet?.signOut();
    }
  }, [nearWallet, rawDisconnectAsync, selectedChain?.networkType]);

  return {
    address,
    isDisconnecting,
    disconnectAsync,
  };
}

export function useGetAtlasBTCBalanceMultiChain({
  selectedChain,
}: {
  selectedChain?: ChainConfig | undefined;
}) {
  const selectedEVMChain =
    selectedChain?.networkType === "EVM" ? selectedChain : undefined;
  const selectedNearChain =
    selectedChain?.networkType === "NEAR" ? selectedChain : undefined;

  const { data: aBTCEVMBalance, refetch: refetchaEVMBTCBalance } =
    useTokenBalance({
      tokenAddress: selectedEVMChain?.aBTCAddress,
      chainId: selectedEVMChain ? Number(selectedEVMChain?.chainID) : undefined,
    });

  const { data: aBTCNearBalance, refetch: refetchNearBTCBalance } =
    useNearTokenBalance({
      tokenContract: selectedNearChain?.aBTCAddress,
    });

  const result = useMemo<{
    value: BigInt;
    formatted: number;
  }>(() => {
    let final = {
      value: BigInt(0),
      formatted: 0,
    };

    if (selectedChain?.networkType === "EVM" && aBTCEVMBalance) {
      final.value = aBTCEVMBalance.value;
      final.formatted = Number(aBTCEVMBalance.formatted);
    } else if (selectedChain?.networkType === "NEAR" && aBTCNearBalance) {
      final.value = aBTCNearBalance.value;
      final.formatted = Number(aBTCNearBalance.formatted);
    }

    return final;
  }, [aBTCEVMBalance, aBTCNearBalance, selectedChain?.networkType]);

  return {
    result,
    refetch:
      selectedChain?.networkType === "EVM"
        ? refetchaEVMBTCBalance
        : refetchNearBTCBalance,
  };
}
