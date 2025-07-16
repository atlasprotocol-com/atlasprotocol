"use client";

import { useState } from "react";
import { BiInfoCircle } from "react-icons/bi";
import { FaDownload, FaExternalLinkAlt } from "react-icons/fa";
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
        <p className="text-neutral-6 dark:text-neutral-4">
          Please connect wallet to start using Atlas
        </p>
      </div>

      {/* Compact Wallet Setup Guide */}
      <div className="w-full max-w-md mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <BiInfoCircle
              className="text-blue-600 dark:text-blue-400 mt-0.5"
              size={20}
            />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                New to Bitcoin wallets?
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                <a
                  href="https://unisat.io/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors font-medium"
                >
                  <FaDownload size={12} />
                  Download Unisat Wallet
                  <FaExternalLinkAlt size={10} />
                </a>{" "}
                and switch to <strong>Bitcoin Testnet4</strong> network.
              </p>
            </div>
          </div>
        </div>
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
