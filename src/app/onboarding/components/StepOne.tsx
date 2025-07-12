"use client";

import { useState } from "react";
import { PiWalletBold } from "react-icons/pi";

import { Button } from "@/app/components/Button";
import { ConnectModal } from "@/app/components/Modals/ConnectModal";
import { ErrorModal } from "@/app/components/Modals/ErrorModal";
import { useError } from "@/app/context/Error/ErrorContext";
import { WalletProvider } from "@/utils/wallet/wallet_provider";

interface StepOneProps {
  onConnect: (walletProvider: WalletProvider) => Promise<void>;
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


  const handleConnect = async (walletProvider: WalletProvider) => {
    try {
      await onConnect(walletProvider);
      setConnectModalOpen(false);
      onWalletConnected();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      // Error will be handled by the context
    }
  };

  const handleConnectModal = () => {
    setConnectModalOpen(true);
  };

  // Always show the "Welcome to Atlas" state during onboarding
  // The parent component handles the flow logic
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
        onClose={() => setConnectModalOpen(false)}
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
