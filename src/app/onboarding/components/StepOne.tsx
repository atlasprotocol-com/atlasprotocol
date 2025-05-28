"use client";

import { useState } from "react";
import { PiWalletBold } from "react-icons/pi";

import { Button } from "@/app/components/Button";
import { ConnectModal } from "@/app/components/Modals/ConnectModal";
import { WalletProvider } from "@/utils/wallet/wallet_provider";

interface StepOneProps {
  onConnect: (walletProvider: WalletProvider) => void;
  onWalletConnected: () => void;
  connectDisabled: boolean;
}

export const StepOne: React.FC<StepOneProps> = ({
  onConnect,
  onWalletConnected,
  connectDisabled,
}) => {
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const handleConnect = (walletProvider: WalletProvider) => {
    onConnect(walletProvider);
    setConnectModalOpen(false);
    onWalletConnected();
  };

  const handleConnectModal = () => {
    setConnectModalOpen(true);
  };

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
    </div>
  );
};
