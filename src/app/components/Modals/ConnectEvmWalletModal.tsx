import { StaticImageData } from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { PiWalletBold } from "react-icons/pi";
import { twMerge } from "tailwind-merge";
import { Connector, useConnect, useDisconnect } from "wagmi";

import injectedWalletIcon from "@/app/assets/browser-wallet-icon.png"; // Corrected path
import { useError } from "@/app/context/Error/ErrorContext";
import { useTerms } from "@/app/context/Terms/TermsContext";
import { ErrorState } from "@/app/types/errors";

import { Button } from "../Button";
import { Dialog } from "../Dialog";

interface ConnectEvmWalletModalProps {
  isOpen: boolean;
  onClose: (success?: boolean) => void;
  selectedChain: string | null; // Add selectedChain prop
  selectedChainID: string | null; // Add selectedChainID prop
}

export const ConnectEvmWalletModal: React.FC<ConnectEvmWalletModalProps> = ({
  isOpen,
  onClose,
  selectedChain,
  selectedChainID,
}) => {
  const { disconnectAsync } = useDisconnect();
  const { connectors, connectAsync, isPending, status, error } = useConnect();

  const uniqueConnectors = useMemo(() => {
    return connectors.filter((connector) => connector.id !== "metaMaskSDK");
  }, [connectors]);

  const [accepted, setAccepted] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const [injectedWalletProviderName, setInjectedWalletProviderName] =
    useState("MetaMask");
  const [injectedWalletProviderIcon, setInjectedWalletProviderIcon] =
    useState<StaticImageData | null>(null);

  const { openTerms } = useTerms();
  const { isErrorOpen, showError } = useError();

  useEffect(() => {
    const fetchWalletProviderDetails = async () => {
      if (window.ethereum) {
        const name = "Browser Wallet";
        setInjectedWalletProviderName(name);
        setInjectedWalletProviderIcon(injectedWalletIcon);
      }
    };

    setMounted(true);
    fetchWalletProviderDetails();
  }, []);

  if (!mounted) {
    return null;
  }

  const handleConnect = async () => {
    // if (!selectedChainID || !selectedConnector === null) {
    //   console.error("No chain selected.");
    //   return;
    // }
    try {
      if (!selectedConnector) {
        console.error("No connector selected.");
        return;
      }

      if (!selectedChainID) {
        console.error("No chain ID selected.");
        return;
      }

      await disconnectAsync();

      await connectAsync({
        connector: selectedConnector,
        chainId: Number(selectedChainID),
      });

      onClose(true);
    } catch (error) {
      console.log(error);
      showError({
        error: {
          message: (error as Error).message,
          errorState: ErrorState.WALLET,
          errorTime: new Date(),
        },
      });
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={
        !isPending
          ? () => {
              onClose();
            }
          : undefined
      }
      headerTitle="Connect EVM Wallet"
    >
      <div className="flex flex-col justify-center gap-4">
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold ">Choose wallet</h3>
          <div className="grid max-h-[20rem] grid-cols-1 gap-4 overflow-y-auto">
            {uniqueConnectors.map((connector) => {
              let icon = "/wallet-icons/browser-wallet-icon.png";
              return (
                <button
                  disabled={isPending}
                  key={connector.id}
                  className={twMerge(
                    "cursor-pointer h-16 p-3 dark:bg-neutral-10 rounded-lg border border-neutral-5 dark:border-neutral-10 justify-start items-center inline-flex gap-4",
                    selectedWallet === connector.id &&
                      "border-primary dark:border-primary",
                  )}
                  onClick={() => {
                    setSelectedWallet(connector.id);
                    setSelectedConnector(connector);
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-neutral-3 dark:bg-neutral-1 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={(connector.icon || icon) as any}
                      alt={connector.name}
                      width={26}
                      height={26}
                      data-testid="wallet-icon"
                    />
                  </div>
                  <p>{connector.name}</p>
                </button>
              );
            })}
          </div>
          <p className="text-sm">
            By connecting, I certify that I have read and accept the updated{" "}
            <button className="inline text-primary" onClick={openTerms}>
              Terms of Use.
            </button>
          </p>
        </div>
        <Button
          className="mt-6"
          onClick={handleConnect}
          startIcon={<PiWalletBold size={20} />}
        >
          Connect to EVM network
        </Button>
      </div>
    </Dialog>
  );
};
