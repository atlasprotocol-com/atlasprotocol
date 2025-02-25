import { networks } from "bitcoinjs-lib";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useError } from "@/app/context/Error/ErrorContext";
import { ErrorState } from "@/app/types/errors";
import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";
import {
  getPublicKeyNoCoord,
  isSupportedAddressType,
  toNetwork,
} from "@/utils/wallet";
import { WalletError, WalletErrorType } from "@/utils/wallet/errors";
import { WalletProvider } from "@/utils/wallet/wallet_provider";

import { useCallbackRef } from "./useCallbackRef";

export function useConnectBTCWallet({
  onSuccessfulConnect,
}: {
  onSuccessfulConnect?: () => void;
} = {}) {
  const onSuccessfulConnectRef = useCallbackRef(onSuccessfulConnect);
  const [btcWallet, setBTCWallet] = useState<WalletProvider | undefined>();
  const [btcWalletBalanceSat, setBTCWalletBalanceSat] = useState<number>(0);
  const [btcWalletNetwork, setBTCWalletNetwork] = useState<
    networks.Network | undefined
  >();
  const [publicKeyNoCoord, setPublicKeyNoCoord] = useState<string>("");

  const [address, setAddress] = useState<string>("");
  const { showError } = useError();

  const handleConnectBTC = useCallback(
    async (walletProvider: WalletProvider) => {
      try {
        await walletProvider.connectWallet();
        const address = await walletProvider.getAddress();
        const supported = isSupportedAddressType(address);

        if (!supported) {
          throw new Error(
            "Invalid address type. Please use a Native SegWit or Taproot address.",
          );
        }

        const balanceSat = await walletProvider.getBalance();
        const publicKeyNoCoord = getPublicKeyNoCoord(
          await walletProvider.getPublicKeyHex(),
        );
        setBTCWallet(walletProvider);
        setBTCWalletBalanceSat(balanceSat);
        setBTCWalletNetwork(toNetwork(await walletProvider.getNetwork()));
        setAddress(address);
        setPublicKeyNoCoord(publicKeyNoCoord.toString("hex"));
        onSuccessfulConnectRef();
      } catch (error: any) {
        console.error(error);
        if (
          error instanceof WalletError &&
          error.getType() === WalletErrorType.ConnectionCancelled
        ) {
          return;
        }
        showError({
          error: {
            message: error.message,
            errorState: ErrorState.WALLET,
            errorTime: new Date(),
          },
          retryAction: () => handleConnectBTC(walletProvider),
        });
      }
    },
    [onSuccessfulConnectRef, showError],
  );

  const handleDisconnectBTC = useCallback(() => {
    setBTCWallet(undefined);
    setBTCWalletBalanceSat(0);
    setBTCWalletNetwork(undefined);
    setPublicKeyNoCoord("");
    setAddress("");
  }, []);

  useEffect(() => {
    if (btcWallet) {
      let once = false;
      btcWallet.on("accountChanged", () => {
        if (!once) {
          handleConnectBTC(btcWallet);
        }
      });
      return () => {
        once = true;
      };
    }
  }, [btcWallet, handleConnectBTC]);

  const formattedBalance = useMemo(() => {
    return maxDecimals(satoshiToBtc(btcWalletBalanceSat), 8) || 0;
  }, [btcWalletBalanceSat]);

  const refetchBalance = useCallback(async () => {
    if (btcWallet) {
      setBTCWalletBalanceSat(await btcWallet.getBalance());
    }
  }, [btcWallet]);

  return {
    btcWallet,
    btcWalletBalanceSat,
    btcWalletNetwork,
    publicKeyNoCoord,
    address,
    handleConnectBTC,
    handleDisconnectBTC,
    formattedBalance,
    refetchBalance,
  };
}
