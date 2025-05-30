import { networks } from "bitcoinjs-lib";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiWrapper } from "@/app/api/apiWrapper";
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
import { walletList } from "@/utils/wallet/list";
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
  const [btcManualMinusBalance, setBTCManualMinusBalance] = useState<
    number | undefined
  >(undefined);
  const [btcWalletNetwork, setBTCWalletNetwork] = useState<
    networks.Network | undefined
  >();
  const [publicKeyNoCoord, setPublicKeyNoCoord] = useState<string>("");
  const [publicKeyHex, setPublicKeyHex] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const { showError } = useError();
  const [isConnecting, setIsConnecting] = useState<boolean>(true);

  const currentBalance = useMemo(() => {
    return btcManualMinusBalance ? btcManualMinusBalance : btcWalletBalanceSat;
  }, [btcManualMinusBalance, btcWalletBalanceSat]);

  const handleConnectBTC = useCallback(
    async (walletProvider: WalletProvider) => {
      setIsConnecting(true);
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
        const publicHeyHex = await walletProvider.getPublicKeyHex();
        const publicKeyNoCoord = getPublicKeyNoCoord(publicHeyHex);
        console.log("Connected wallet public key:", publicHeyHex);

        setBTCWallet(walletProvider);
        setBTCWalletBalanceSat(balanceSat);
        setBTCWalletNetwork(toNetwork(await walletProvider.getNetwork()));
        setAddress(address);
        setPublicKeyNoCoord(publicKeyNoCoord.toString("hex"));
        setPublicKeyHex(publicHeyHex);
        // Call the API to insert BTC public key
        try {
          await apiWrapper(
            "GET",
            "/api/v1/insert-btc-pubkey",
            "Error while capturing BTC public key",
            {
              btcAddress: address,
              publicKey: publicHeyHex,
            },
          );
        } catch (error) {
          console.error("Error while capturing BTC public key:", error);
        }

        onSuccessfulConnectRef();
        localStorage.setItem(
          "ATLAS_CONNECTED_WALLET",
          walletProvider.name || "",
        );
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
      } finally {
        setIsConnecting(false);
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
    localStorage.removeItem("ATLAS_CONNECTED_WALLET");
  }, []);

  useEffect(() => {
    try {
      const connectedWallet = localStorage.getItem("ATLAS_CONNECTED_WALLET");
      const wallet = walletList.find(
        (wallet) => wallet.name === connectedWallet,
      );
      if (connectedWallet && wallet) {
        handleConnectBTC(new wallet.wallet());
      } else {
        setIsConnecting(false);
      }
    } catch (error) {
      console.error(error);
    }
  }, [handleConnectBTC]);

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
    return maxDecimals(satoshiToBtc(currentBalance), 8) || 0;
  }, [currentBalance]);

  const refetchBalance = useCallback(async () => {
    if (btcWallet) {
      const balance = await btcWallet.getBalance();

      if (
        btcManualMinusBalance !== undefined &&
        balance !== btcWalletBalanceSat
      ) {
        setBTCManualMinusBalance(undefined);
      }

      setBTCWalletBalanceSat(balance);
    }
  }, [btcManualMinusBalance, btcWallet, btcWalletBalanceSat]);

  const manualMinusBalance = useCallback(
    (balance: number) => {
      setBTCManualMinusBalance(Math.max(0, currentBalance - balance));
    },
    [currentBalance],
  );

  return {
    btcWallet,
    btcWalletBalanceSat: currentBalance,
    btcWalletNetwork,
    publicKeyNoCoord,
    publicKeyHex,
    address,
    handleConnectBTC,
    handleDisconnectBTC,
    formattedBalance,
    refetchBalance,
    btcManualMinusBalance,
    manualMinusBalance,
    isConnecting,
  };
}
