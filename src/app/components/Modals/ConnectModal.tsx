import Image from "next/image";
import { useEffect, useState } from "react";
import { AiOutlineInfoCircle } from "react-icons/ai";
import { FaWallet } from "react-icons/fa";
import { PiWalletBold } from "react-icons/pi";
import { Tooltip } from "react-tooltip";
import { twMerge } from "tailwind-merge";

import { useTerms } from "@/app/context/Terms/TermsContext";
import { getNetworkConfig } from "@/config/network.config";
import { BROWSER_INJECTED_WALLET_NAME, walletList } from "@/utils/wallet/list";
import { WalletProvider } from "@/utils/wallet/wallet_provider";

import { Button } from "../Button";
import { Dialog } from "../Dialog";

interface ConnectModalProps {
  open: boolean;
  onClose: (value: boolean) => void;
  onConnect: (walletProvider: WalletProvider) => void;
  connectDisabled: boolean;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  open,
  onClose,
  onConnect,
  connectDisabled,
}) => {
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  const [injectedWalletProviderName, setInjectedWalletProviderName] =
    useState("Browser");
  const [injectedWalletProviderIcon, setInjectedWalletProviderIcon] =
    useState("");

  // This constant is used to identify the browser wallet
  // And whether or not it should be injected
  const BROWSER = "btcwallet";

  const { openTerms } = useTerms();

  useEffect(() => {
    const fetchWalletProviderDetails = async () => {
      // Check if the browser wallet is injectable
      if (window[BROWSER]) {
        // Get the name and icon of the injected wallet
        const name =
          window[BROWSER].getWalletProviderName &&
          (await window[BROWSER].getWalletProviderName());
        const icon =
          window[BROWSER].getWalletProviderIcon &&
          (await window[BROWSER].getWalletProviderIcon());
        // Set the name and icon of the injected wallet if they exist
        name && setInjectedWalletProviderName(`${name} (Browser)`);
        icon && setInjectedWalletProviderIcon(icon);
      }
    };

    setMounted(true);
    fetchWalletProviderDetails();
  }, []);

  if (!mounted) {
    return null;
  }

  const isInjectable = !!window[BROWSER];
  const { networkName } = getNetworkConfig();

  const handleConnect = async () => {
    if (selectedWallet) {
      let walletInstance: WalletProvider;

      if (selectedWallet === BROWSER) {
        if (!isInjectable) {
          throw new Error("Browser selected without an injectable interface");
        }
        // we are using the browser wallet
        walletInstance = window[BROWSER];
      } else {
        // we are using a custom wallet
        console.log(selectedWallet, walletList);
        const walletProvider = walletList.find(
          (w) => w.name === selectedWallet,
        )?.wallet;
        if (!walletProvider) {
          throw new Error("Wallet provider not found");
        }
        walletInstance = new walletProvider();
      }

      onConnect(walletInstance);
    }
  };

  const buildInjectableWallet = (shouldDisplay: boolean, name: string) => {
    if (!shouldDisplay) {
      return null;
    }

    return (
      <button
        key={name}
        className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 bg-base-100 p-2 transition-all hover:text-primary ${selectedWallet === BROWSER ? "border-primary" : "border-base-100"}`}
        onClick={() => setSelectedWallet(BROWSER)}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-white p-2 text-black">
          {injectedWalletProviderIcon ? (
            <Image
              src={injectedWalletProviderIcon}
              alt={injectedWalletProviderName}
              width={26}
              height={26}
            />
          ) : (
            <FaWallet size={26} />
          )}
        </div>
        <p>{injectedWalletProviderName}</p>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose} headerTitle="Connect wallet">
      <div className="flex flex-col justify-center">
        <div className="form-control"></div>
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold ">Choose wallet</h3>
          <div className="grid max-h-[20rem] grid-cols-1 gap-4 overflow-y-auto">
            {walletList.map(
              ({
                provider,
                name,
                linkToDocs,
                icon,
                isQRWallet,
                supportedNetworks,
              }) => {
                if (name === BROWSER_INJECTED_WALLET_NAME) {
                  return buildInjectableWallet(isInjectable, name);
                }
                const walletAvailable = isQRWallet || !!window[provider as any];

                // If the wallet is integrated but does not support the current network, do not display it
                if (
                  !supportedNetworks ||
                  !supportedNetworks.includes(getNetworkConfig().network)
                ) {
                  return null;
                }

                const selected = selectedWallet === name;

                return (
                  <a
                    key={name}
                    className={twMerge(
                      "cursor-pointer h-16 p-3 bg:neutral-3 dark:bg-neutral-10 rounded-lg border border-neutral-5 dark:border-neutral-10 justify-start items-center inline-flex gap-4",
                      selected && "border-primary dark:border-primary",
                    )}
                    onClick={
                      walletAvailable
                        ? () => setSelectedWallet(name)
                        : undefined
                    }
                    href={!walletAvailable ? linkToDocs : undefined}
                    target={!walletAvailable ? "_blank" : undefined}
                    rel={!walletAvailable ? "noopener noreferrer" : undefined}
                  >
                    <div className="flex flex-1 items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-3 dark:bg-white p-2">
                        <Image src={icon} alt={name} width={20} height={20} />
                      </div>
                      <p>{name}</p>
                      {isQRWallet && (
                        <div>
                          <span
                            className="cursor-pointer text-xs"
                            data-tooltip-id={name}
                            data-tooltip-content="QR codes used for connection/signing"
                            data-tooltip-place="top"
                          >
                            <AiOutlineInfoCircle />
                          </span>
                          <Tooltip id={name} />
                        </div>
                      )}
                    </div>
                  </a>
                );
              },
            )}
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
          disabled={connectDisabled || !selectedWallet}
          startIcon={<PiWalletBold size={20} />}
        >
          Connect to {networkName} network
        </Button>
      </div>
    </Dialog>
  );
};
