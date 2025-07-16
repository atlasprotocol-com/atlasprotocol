"use client";

import { Button } from "@/app/components/Button";
import { Dialog } from "@/app/components/Dialog";

interface OnboardingCompleteModalProps {
  open: boolean;
  onClose: () => void;
  onAccessAtlas: () => void;
  walletType: "BTC" | "EVM" | "NEAR" | null;
  isLoading?: boolean;
}

export const OnboardingCompleteModal: React.FC<
  OnboardingCompleteModalProps
> = ({ open, onClose, onAccessAtlas, walletType, isLoading = false }) => {
  const renderBTCWalletMessage = () => (
    <div className="text-center">
      <div className="mb-6">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🎉</span>
        </div>
        <h2 className="text-2xl font-bold mb-4 text-green-600 dark:text-green-400">
          Welcome to Atlas!
        </h2>
        <p className="text-neutral-6 dark:text-neutral-4 text-lg leading-relaxed">
          Atlas has a NEW look! Explore our interface and stake your testnet-BTC
          to start earning rewards.
        </p>
      </div>
      <Button onClick={onAccessAtlas} disabled={isLoading} className="w-full">
        {isLoading ? "Accessing Atlas..." : "Explore Atlas"}
      </Button>
    </div>
  );

  const renderNonBTCWalletMessage = () => (
    <div className="text-center">
      <div className="mb-6">
        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-bold mb-4 text-orange-600 dark:text-orange-400">
          BTC Wallet Required
        </h2>
        <div className="text-left space-y-4 mb-6">
          <p className="text-neutral-6 dark:text-neutral-4">
            Current testnet actions are only available on the Bitcoin chain. To
            get started:
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">
                1
              </span>
              <div>
                <p className="font-medium">Setup a BTC Wallet</p>
                <div className="space-y-1 mt-2">
                  <div>
                    <a
                      href="https://unisat.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 text-xs underline"
                    >
                      Download Unisat
                    </a>
                  </div>
                  <div>
                    <a
                      href="https://www.xverse.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 text-xs underline"
                    >
                      Download Xverse
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">
                2
              </span>
              <div>
                <p className="font-medium">Claim testnet BTC</p>
                <a
                  href="https://mempool.space/testnet4/faucet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 text-xs underline mt-1 inline-block"
                >
                  Get testnet BTC from faucet →
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">
                3
              </span>
              <div>
                <p className="font-medium">
                  Return to Atlas and stake your testnet-BTC
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <Button
          onClick={onAccessAtlas}
          disabled={isLoading}
          variant="outline"
          className="flex-1"
        >
          {isLoading ? "Accessing..." : "Continue to Atlas"}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onClose}
      headerTitle="Onboarding Complete"
    >
      <div className="max-w-md mx-auto">
        {walletType === "BTC"
          ? renderBTCWalletMessage()
          : renderNonBTCWalletMessage()}
      </div>
    </Dialog>
  );
};
