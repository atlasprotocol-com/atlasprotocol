"use client";

import { useContext, useEffect, useState } from "react";
import { PiWalletBold } from "react-icons/pi";

import { Button } from "@/app/components/Button";
import { ConnectModal } from "@/app/components/Modals/ConnectModal";
import { ErrorModal } from "@/app/components/Modals/ErrorModal";
import { useError } from "@/app/context/Error/ErrorContext";
import { useEvmWallet } from "@/utils/evm_wallet/wallet_provider";
import { NearContext } from "@/utils/near";
import { WalletProvider } from "@/utils/wallet/wallet_provider";

interface StepOneProps {
  onConnect: (walletProvider: WalletProvider) => void;
  onWalletConnected: () => void;
  connectDisabled: boolean;
  address?: string;
}

export const StepOne: React.FC<StepOneProps> = ({
  onConnect,
  onWalletConnected,
  connectDisabled,
  address,
}) => {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const { error, isErrorOpen, hideError, retryErrorAction } = useError();
  const { signedAccountId: nearAccountId } = useContext(NearContext);
  const { evmAddress, isEvmWalletConnected } = useEvmWallet();

  // Auto-trigger onWalletConnected if wallet is already connected
  useEffect(() => {
    if (address && connectDisabled) {
      // Small delay to allow the auto-advance useEffect to trigger
      const timer = setTimeout(() => {
        onWalletConnected();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [address, connectDisabled, onWalletConnected]);

  // Handle EVM wallet connections
  useEffect(() => {
    if (evmAddress && !address && !nearAccountId) {
      // Create an EVM wallet wrapper when EVM wallet connects
      const evmWalletWrapper = {
        id: "evm-wallet",
        name: "EVM Wallet",
        connectWallet: async () => evmWalletWrapper,
        getWalletProviderName: async () => "EVM Wallet",
        getAddress: async () => evmAddress,
        getPublicKeyHex: async () => "",
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

      // Call onConnect when EVM wallet is actually connected
      onConnect(evmWalletWrapper);
      onWalletConnected();
    }
  }, [evmAddress, address, nearAccountId, onConnect, onWalletConnected]);

  // Handle Near wallet connections
  useEffect(() => {
    if (nearAccountId && !address) {
      // Create a Near wallet wrapper when Near wallet connects
      const nearWalletWrapper = {
        id: "near-wallet",
        name: "Near Wallet",
        connectWallet: async () => nearWalletWrapper,
        getWalletProviderName: async () => "Near Wallet",
        getAddress: async () => nearAccountId,
        getPublicKeyHex: async () => "",
        signPsbt: async () => {
          throw new Error("PSBT signing not supported for Near wallets");
        },
        signPsbts: async () => {
          throw new Error("PSBT signing not supported for Near wallets");
        },
        getNetwork: async () => {
          throw new Error("Network not applicable for Near wallets");
        },
        signMessageBIP322: async () => {
          throw new Error("BIP322 not supported for Near wallets");
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
          throw new Error("BTC transaction not supported for Near wallets");
        },
        getUtxos: async () => [],
        getBTCTipHeight: async () => 0,
      } as WalletProvider;

      // Call onConnect when Near wallet is actually connected
      onConnect(nearWalletWrapper);
      onWalletConnected();
    }
  }, [nearAccountId, address, onConnect, onWalletConnected]);

  const handleConnect = (walletProvider: WalletProvider) => {
    onConnect(walletProvider);
    setConnectModalOpen(false);
    onWalletConnected();
  };

  const handleConnectModal = () => {
    setConnectModalOpen(true);
  };

  // Show different content based on wallet connection status
  // Check both BTC address, EVM address, and Near account ID
  const isConnected =
    (address && connectDisabled) || nearAccountId || evmAddress;
  const displayAddress = address || evmAddress || nearAccountId;

  if (isConnected && displayAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Wallet Connected!</h2>
          <p className="text-green-600 dark:text-green-400 mb-2">
            ✓ Successfully connected
          </p>
          <p className="text-sm text-neutral-6 dark:text-neutral-4 font-mono">
            {displayAddress.length > 24
              ? `${displayAddress.slice(0, 8)}...${displayAddress.slice(-8)}`
              : displayAddress}
          </p>
          <p className="text-xs text-neutral-5 dark:text-neutral-5 mt-1">
            {nearAccountId
              ? "Near Wallet"
              : evmAddress
                ? "EVM Wallet"
                : "Bitcoin Wallet"}
          </p>
        </div>

        <div className="flex items-center gap-2 text-neutral-6 dark:text-neutral-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span>Proceeding to next step...</span>
        </div>

        {/* Error Modal */}
        <ErrorModal
          open={isErrorOpen}
          errorMessage={error.message}
          errorState={error.errorState}
          errorTime={error.errorTime}
          onClose={hideError}
          onRetry={retryErrorAction}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="mb-8">
        <h2 className="font-display text-2xl font-bold mb-4">
          Welcome to Atlas
        </h2>
        <p className="text-neutral-6 dark:text-neutral-4 mb-2">
          Please connect wallet to start using Atlas
        </p>
      </div>

      <div className="w-full max-w-md">
        <Button
          onClick={handleConnectModal}
          disabled={connectDisabled}
          startIcon={<PiWalletBold size={20} />}
          className="w-full h-16 text-lg"
        >
          Connect Wallet
        </Button>
      </div>

      <ConnectModal
        open={connectModalOpen}
        onClose={setConnectModalOpen}
        onConnect={handleConnect}
        connectDisabled={connectDisabled}
        showAll={true}
      />

      {/* Error Modal */}
      <ErrorModal
        open={isErrorOpen}
        errorMessage={error.message}
        errorState={error.errorState}
        errorTime={error.errorTime}
        onClose={hideError}
        onRetry={retryErrorAction}
      />
    </div>
  );
};
