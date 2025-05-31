"use client";

import { useEffect, useState } from "react";
import { PiWalletBold } from "react-icons/pi";

import { Button } from "@/app/components/Button";
import { ConnectModal } from "@/app/components/Modals/ConnectModal";
import { ErrorModal } from "@/app/components/Modals/ErrorModal";
import { useError } from "@/app/context/Error/ErrorContext";
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

  const handleConnect = (walletProvider: WalletProvider) => {
    onConnect(walletProvider);
    setConnectModalOpen(false);
    onWalletConnected();
  };

  const handleConnectModal = () => {
    setConnectModalOpen(true);
  };

  // Show different content based on wallet connection status
  if (connectDisabled && address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Wallet Connected!</h2>
          <p className="text-green-600 dark:text-green-400 mb-2">
            ✓ Successfully connected
          </p>
          <p className="text-sm text-neutral-6 dark:text-neutral-4 font-mono">
            {address.slice(0, 8)}...{address.slice(-8)}
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
        <h2 className="text-2xl font-bold mb-4">Welcome to Atlas</h2>
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
