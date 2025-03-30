import { StaticImageData } from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { IoMdClose } from "react-icons/io";
import { PiWalletBold } from "react-icons/pi";
import { Connector, useConnect, useDisconnect } from "wagmi";

import injectedWalletIcon from "@/app/assets/browser-wallet-icon.png"; // Corrected path
import { useError } from "@/app/context/Error/ErrorContext";
import { useTerms } from "@/app/context/Terms/TermsContext";
import { ErrorState } from "@/app/types/errors";

import { GeneralModal } from "./GeneralModal";

// declare global {
//   interface Window {
//     ethereum?: MetaMaskInpageProvider;
//   }
// }

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
    <GeneralModal
      open={isOpen}
      onClose={
        !isPending
          ? () => {
              onClose();
            }
          : undefined
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold">Connect EVM Wallet</h3>
        <button
          className="btn btn-circle btn-ghost btn-sm"
          onClick={() => {
            !isPending && onClose();
          }}
        >
          <IoMdClose size={24} />
        </button>
      </div>
      <div className="flex flex-col justify-center gap-4">
        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-2 rounded-xl bg-base-100 p-4">
            <input
              type="checkbox"
              className="checkbox-primary checkbox"
              onChange={(e) => setAccepted(e.target.checked)}
              checked={accepted}
            />
            <span className="label-text">
              I certify that I have read and accept the updated{" "}
              <button
                onClick={openTerms}
                className="transition-colors hover:text-primary cursor-pointer btn btn-link no-underline text-base-content px-0 h-auto min-h-0"
              >
                Terms of Use
              </button>
              .
            </span>
          </label>
        </div>
        <div className="my-4 flex flex-col gap-4">
          <h3 className="text-center font-semibold">Choose wallet</h3>
          <div className="grid max-h-[20rem] grid-cols-1 gap-4 overflow-y-auto">
            {uniqueConnectors.map((connector) => {
              let icon = "/wallet-icons/browser-wallet-icon.png";

              return (
                <button
                  disabled={isPending}
                  key={connector.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 bg-base-100 p-2 transition-all hover:text-primary ${selectedWallet === connector.id ? "border-primary" : "border-base-100"}`}
                  onClick={() => {
                    setSelectedWallet(connector.id);
                    setSelectedConnector(connector);
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-white p-2 text-black">
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
        </div>
        <button
          className="btn-primary btn h-[2.5rem] min-h-[2.5rem] rounded-lg px-2 text-white"
          onClick={handleConnect}
          disabled={!accepted || !selectedWallet}
        >
          <PiWalletBold size={20} />
          Connect to EVM network
        </button>
      </div>
    </GeneralModal>
  );
};