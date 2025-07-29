import Image, { StaticImageData } from "next/image";
import { useContext, useEffect, useState } from "react";
import { AiOutlineInfoCircle } from "react-icons/ai";
import { PiWalletBold } from "react-icons/pi";
import { Tooltip } from "react-tooltip";
import { twMerge } from "tailwind-merge";
import { useConnect, useDisconnect } from "wagmi";

import { useError } from "@/app/context/Error/ErrorContext";
import { useTerms } from "@/app/context/Terms/TermsContext";
import { ErrorState } from "@/app/types/errors";
import { getNetworkConfig } from "@/config/network.config";
import { useEvmWallet } from "@/utils/evm_wallet/wallet_provider";
import { NearContext } from "@/utils/near";
import { BROWSER_INJECTED_WALLET_NAME, walletList } from "@/utils/wallet/list";
import { WalletProvider } from "@/utils/wallet/wallet_provider";

import { Button } from "../Button";
import { Dialog } from "../Dialog";

interface ConnectModalProps {
  open: boolean;
  onClose: (value: boolean) => void;
  onConnect: (walletProvider: WalletProvider) => void;
  connectDisabled: boolean;
  showAll?: boolean;
}

type WalletType = "BTC" | "EVM" | "NEAR";

interface WalletOption {
  type: WalletType;
  id: string;
  name: string;
  icon: string | StaticImageData;
  isAvailable: boolean;
  isQRWallet?: boolean;
  linkToDocs?: string;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  open,
  onClose,
  onConnect,
  connectDisabled,
  showAll = false,
}) => {
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [selectedWalletType, setSelectedWalletType] =
    useState<WalletType | null>(null);
  const [mounted, setMounted] = useState(false);

  const [injectedWalletProviderName, setInjectedWalletProviderName] =
    useState("Browser");
  const [injectedWalletProviderIcon, setInjectedWalletProviderIcon] =
    useState("");

  // This constant is used to identify the browser wallet
  // And whether or not it should be injected
  const BROWSER = "btcwallet";

  const { openTerms } = useTerms();
  const { showError } = useError();
  const { wallet: nearWallet } = useContext(NearContext);
  const { connectAsync: connectEvmAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const evmc = useEvmWallet();

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

  // Prepare wallet options
  const btcWallets: WalletOption[] = [];

  // Add BTC browser wallet if available
  if (isInjectable) {
    btcWallets.push({
      type: "BTC",
      id: BROWSER,
      name: injectedWalletProviderName,
      icon:
        injectedWalletProviderIcon || "/wallet-icons/browser-wallet-icon.png",
      isAvailable: true,
    });
  }

  // Add other BTC wallets
  walletList.forEach(
    ({ provider, name, linkToDocs, icon, isQRWallet, supportedNetworks }) => {
      if (name === BROWSER_INJECTED_WALLET_NAME) return;

      const walletAvailable = isQRWallet || !!window[provider as any];
      const supportsNetwork = supportedNetworks?.includes(
        getNetworkConfig().network,
      );

      if (supportsNetwork) {
        btcWallets.push({
          type: "BTC",
          id: name,
          name,
          icon,
          isAvailable: walletAvailable,
          isQRWallet,
          linkToDocs,
        });
      }
    },
  );

  // EVM wallets
  const evmWallets: WalletOption[] = connectors
    .filter((connector) => connector.id !== "metaMaskSDK")
    .map((connector) => ({
      type: "EVM" as WalletType,
      id: connector.id,
      name: connector.name,
      icon: connector.icon || "/wallet-icons/browser-wallet-icon.png",
      isAvailable: true,
    }));

  // Near wallets - simplified to one option that opens the Near wallet selector
  const nearWallets: WalletOption[] = [
    {
      type: "NEAR",
      id: "near-wallet-selector",
      name: "Connect With Near",
      icon: "/wallet-icons/browser-wallet-icon.png", // Using available icon as placeholder
      isAvailable: true,
    },
  ];

  // Combine all wallets with BTC at the top
  const allWallets = [...btcWallets, ...evmWallets, ...nearWallets];

  const handleConnect = async () => {
    if (!selectedWallet || !selectedWalletType) return;

    try {
      if (selectedWalletType === "BTC") {
        let walletInstance: WalletProvider;

        if (selectedWallet === BROWSER) {
          if (!isInjectable) {
            throw new Error("Browser selected without an injectable interface");
          }
          walletInstance = window[BROWSER];
        } else {
          const walletProvider = walletList.find(
            (w) => w.name === selectedWallet,
          )?.wallet;
          if (!walletProvider) {
            throw new Error("Wallet provider not found");
          }
          walletInstance = new walletProvider();
        }
        onConnect(walletInstance);
      } else if (selectedWalletType === "EVM") {
        const connector = connectors.find((c) => c.id === selectedWallet);
        if (!connector) {
          throw new Error("EVM connector not found");
        }

        await disconnectAsync();
        evmc.setIsManualConnected(true);

        await connectEvmAsync({
          connector,
        });

        // For EVM wallets, we need to create a wrapper that implements WalletProvider interface
        // This is a simplified approach - you might need to adjust based on your actual needs
        const evmWalletWrapper = {
          id: connector.id,
          name: connector.name,
          connectWallet: async () => evmWalletWrapper,
          getWalletProviderName: async () => connector.name,
          getAddress: async () => "", // This would be handled by the EVM wallet context
          getPublicKeyHex: async () => "", // EVM uses different key format
          signPsbt: async () => {
            throw new Error("PSBT signing not supported for EVM wallets");
          },
          signPsbts: async () => {
            throw new Error("PSBT signing not supported for EVM wallets");
          },
          getNetwork: async () => {
            throw new Error("Network not applicable for EVM wallets");
          },
          signMessageBIP322: async () => {
            throw new Error("BIP322 not supported for EVM wallets");
          },
          on: () => {},
          getBalance: async () => 0,
          getNetworkFees: async () => ({
            fastestFee: 0,
            halfHourFee: 0,
            hourFee: 0,
            economyFee: 0,
            minimumFee: 0,
          }),
          pushTx: async () => {
            throw new Error("BTC transaction not supported for EVM wallets");
          },
          getUtxos: async () => [],
          getBTCTipHeight: async () => 0,
        } as WalletProvider;

        onConnect(evmWalletWrapper);
      } else if (selectedWalletType === "NEAR") {
        if (!nearWallet) {
          throw new Error("Near wallet not initialized");
        }

        // Close the modal first to show the Near wallet selector
        onClose(false);

        // Use the Near wallet selector modal which handles multiple wallet types
        // Don't call onConnect here - it will be handled when Near wallet actually connects
        await nearWallet.signIn();
      }
    } catch (error) {
      console.error("Wallet connection error:", error);
      showError({
        error: {
          message: (error as Error).message,
          errorState: ErrorState.WALLET,
          errorTime: new Date(),
        },
      });
    }
  };

  const renderWalletSection = (title: string, wallets: WalletOption[]) => {
    if (wallets.length === 0) return null;

    return (
      <div className="mb-6">
        <h4 className="text-sm font-medium text-neutral-6 dark:text-neutral-4 mb-3 uppercase tracking-wider">
          {title}
        </h4>
        <div className="grid gap-3">
          {wallets.map((wallet) => {
            const selected = selectedWallet === wallet.id;

            return (
              <div key={wallet.id}>
                {wallet.isAvailable ? (
                  <button
                    className={twMerge(
                      "cursor-pointer h-16 p-3 w-full bg-neutral-3 dark:bg-neutral-10 rounded-lg border border-neutral-5 dark:border-neutral-10 justify-start items-center inline-flex gap-4 transition-all hover:border-primary/50",
                      selected && "border-primary dark:border-primary",
                    )}
                    onClick={() => {
                      setSelectedWallet(wallet.id);
                      setSelectedWalletType(wallet.type);
                    }}
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-1 dark:bg-white p-2">
                        {typeof wallet.icon === "string" &&
                        (wallet.icon.startsWith("/") ||
                          wallet.icon.startsWith("data:")) ? (
                          <img
                            src={wallet.icon}
                            alt={wallet.name}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        ) : (
                          <Image
                            src={wallet.icon}
                            alt={wallet.name}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        )}
                      </div>
                      <div className="flex flex-col items-start">
                        <p className="font-medium">{wallet.name}</p>
                        <span className="text-xs text-neutral-6 dark:text-neutral-4">
                          {wallet.type}
                        </span>
                      </div>
                      {wallet.isQRWallet && (
                        <div>
                          <span
                            className="cursor-pointer text-xs"
                            data-tooltip-id={wallet.id}
                            data-tooltip-content="QR codes used for connection/signing"
                            data-tooltip-place="top"
                          >
                            <AiOutlineInfoCircle />
                          </span>
                          <Tooltip id={wallet.id} />
                        </div>
                      )}
                    </div>
                  </button>
                ) : (
                  <a
                    href={wallet.linkToDocs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer h-16 p-3 w-full bg-neutral-3/50 dark:bg-neutral-10/50 rounded-lg border border-neutral-5 dark:border-neutral-10 justify-start items-center inline-flex gap-4 opacity-60 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-1 dark:bg-white p-2">
                        {typeof wallet.icon === "string" &&
                        (wallet.icon.startsWith("/") ||
                          wallet.icon.startsWith("data:")) ? (
                          <img
                            src={wallet.icon}
                            alt={wallet.name}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        ) : (
                          <Image
                            src={wallet.icon}
                            alt={wallet.name}
                            width={24}
                            height={24}
                          />
                        )}
                      </div>
                      <div className="flex flex-col items-start">
                        <p className="font-medium">{wallet.name}</p>
                        <span className="text-xs text-neutral-6 dark:text-neutral-4">
                          {wallet.type} • Not installed
                        </span>
                      </div>
                    </div>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose} headerTitle="Connect wallet">
      <div className="flex flex-col justify-center">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">Choose wallet</h3>
            <p className="text-sm text-neutral-6 dark:text-neutral-4">
              Select your preferred wallet to connect to Atlas
            </p>
          </div>

          <div className="max-h-[24rem] overflow-y-auto space-y-2">
            {renderWalletSection("Bitcoin Wallets", btcWallets)}
            {showAll && renderWalletSection("EVM Wallets", evmWallets)}
            {showAll && renderWalletSection("Near Wallets", nearWallets)}
          </div>

          <p className="text-sm text-neutral-6 dark:text-neutral-4">
            By connecting, I certify that I have read and accept the updated{" "}
            <button
              className="inline text-primary hover:text-primary/80 transition-colors"
              onClick={openTerms}
            >
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
          Connect to {selectedWalletType || ""} Wallet
        </Button>
      </div>
    </Dialog>
  );
};
