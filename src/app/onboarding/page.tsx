"use client";

import { useConnectBTCWallet } from "@/hooks/useConnectBTCWallet";
import { useEvmWallet } from "@/utils/evm_wallet/wallet_provider";
import { NearContext } from "@/utils/near";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { useDisconnect } from "wagmi";

import { OnboardingLayout } from "./components/OnboardingLayout";
import { StepOne } from "./components/StepOne";
import { StepTwo } from "./components/StepTwo";
import { useOnboarding } from "./hooks/useOnboarding";
import { onboardingApi } from "./services/onboardingApi";

export default function OnboardingPage() {
  const router = useRouter();
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusCheckError, setStatusCheckError] = useState<string | null>(null);
  const [isAccessAtlasLoading, setIsAccessAtlasLoading] = useState(false);
  const [hasCheckedInitialStatus, setHasCheckedInitialStatus] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // BTC wallet connection
  const {
    address: btcAddress,
    handleConnectBTC,
    handleDisconnectBTC,
  } = useConnectBTCWallet({
    onSuccessfulConnect: () => {
      console.log("BTC Wallet connected successfully");
    },
  });

  // Near wallet connection
  const { signedAccountId: nearAddress, wallet: nearWallet } =
    useContext(NearContext);

  // EVM wallet connection
  const { evmAddress, isEvmWalletConnected, setIsManualConnected } =
    useEvmWallet();
  const { disconnect: disconnectEvm } = useDisconnect();

  // Get BTC address directly from wallet if useConnectBTCWallet doesn't provide it
  const btcWalletAddress =
    btcAddress ||
    (typeof window !== "undefined" && (window as any).unisat?.address);

  // Use whichever wallet is connected (prioritize BTC for backward compatibility, then EVM, then Near)
  const walletAddress = btcWalletAddress || evmAddress || nearAddress;
  const walletType = btcWalletAddress
    ? "BTC"
    : evmAddress
      ? "EVM"
      : nearAddress
        ? "NEAR"
        : null;

  // Only pass address to useOnboarding after we've checked status to prevent auto-advancement
  const {
    currentStep,
    loading,
    socialTasks,
    allSocialTasksCompleted,
    updateSocialTask,
    handleWalletConnected,
    handleSocialTasksComplete,
    handleCompleteOnboarding,
    handleWalletDisconnected,
  } = useOnboarding({
    address: hasCheckedInitialStatus ? walletAddress : undefined,
  });

  // Initialize mounting state and handle initial wallet detection
  useEffect(() => {
    const initializeApp = async () => {
      // Give a small delay to allow wallet providers to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));
      setIsMounted(true);
    };

    initializeApp();
  }, []);

  // Handle browser navigation (back/forward buttons) to reset redirect state
  useEffect(() => {
    const handlePopState = () => {
      console.log(
        "Browser navigation detected on onboarding, resetting redirect state",
      );
      onboardingApi.resetRedirectController();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Check onboarding status when app is mounted and we have wallet info
  useEffect(() => {
    if (!isMounted) return;

    const checkOnboardingStatus = async () => {
      if (!walletAddress) {
        // No wallet connected - allow immediate step 1 display
        setHasCheckedInitialStatus(true);
        return;
      }

      // Wallet is connected - check status before proceeding
      if (hasCheckedInitialStatus) {
        // Already checked for this wallet connection
        return;
      }

      // Check if we can perform a redirect (prevents rapid redirects)
      if (!onboardingApi.canPerformRedirect()) {
        console.log("Redirect throttled, skipping onboarding status check");
        setHasCheckedInitialStatus(true);
        return;
      }

      setIsCheckingStatus(true);
      setStatusCheckError(null);

      try {
        console.log(
          "Checking onboarding status for address:",
          walletAddress,
          "Type:",
          walletType,
        );

        // Add minimum loading time for better UX (prevent flashing)
        const [status] = await Promise.all([
          onboardingApi.checkOnboardingStatus(walletAddress, "onboarding"),
          new Promise((resolve) => setTimeout(resolve, 1000)), // Minimum 1 second display
        ]);

        console.log("Onboarding status check result:", status);

        if (status.isCompleted && status.status !== "api_error") {
          console.log(
            "User has already completed onboarding, redirecting to homepage",
          );
          onboardingApi.setRedirectInProgress(true);
          router.replace("/");
          return;
        }
        // If API error, silently continue with onboarding flow (no error message to user)
      } catch (error) {
        console.error("Failed to check onboarding status:", error);
        setStatusCheckError(
          "Failed to check onboarding status. Continuing with onboarding flow.",
        );
        // Still show minimum loading time even on error
        await new Promise((resolve) => setTimeout(resolve, 500));
      } finally {
        setIsCheckingStatus(false);
        setHasCheckedInitialStatus(true);
      }
    };

    // Add small delay to allow state to settle
    const timeoutId = setTimeout(checkOnboardingStatus, 50);
    return () => clearTimeout(timeoutId);
  }, [walletAddress, walletType, router, hasCheckedInitialStatus, isMounted]);

  // Reset check status when wallet disconnects
  useEffect(() => {
    if (!walletAddress) {
      setHasCheckedInitialStatus(false);
      setIsCheckingStatus(false);
      setStatusCheckError(null);
    }
  }, [walletAddress]);

  const handleLogout = async () => {
    console.log("Logout initiated for wallet type:", walletType);

    if (walletType === "BTC") {
      handleDisconnectBTC();
    } else if (walletType === "NEAR") {
      nearWallet?.signOut();
    } else if (walletType === "EVM") {
      // Disconnect EVM wallet and reset manual connection state
      console.log("Disconnecting EVM wallet...");
      try {
        await disconnectEvm();
      } catch (error) {
        // disconnectEvm might not return a promise, so we handle both cases
        console.log("Disconnect called (might be sync):", error);
      }
      setIsManualConnected(false);

      // Small delay to ensure wagmi state updates are processed
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log("EVM wallet disconnected, evmAddress should now be null");
    }

    console.log("Calling handleWalletDisconnected...");
    handleWalletDisconnected();
    setStatusCheckError(null); // Clear any status check errors

    // Clear redirect state to prevent stale redirects after logout
    onboardingApi.clearAllRedirectState();
    console.log("Logout process completed");
  };

  const handleAccessAtlas = async () => {
    setIsAccessAtlasLoading(true);
    try {
      // Add minimum loading time for better UX (prevent flicker)
      const [_] = await Promise.all([
        handleCompleteOnboarding(""),
        new Promise((resolve) => setTimeout(resolve, 800)), // Minimum 800ms loading
      ]);
    } catch (error) {
      console.error("Failed to access Atlas:", error);
      // Still show minimum loading time even on error
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsAccessAtlasLoading(false);
    }
  };

  // Create a unified connect handler that can handle different wallet types
  const handleConnectWallet = (walletProvider: any) => {
    // Check if this is an EVM wallet by looking at wallet provider properties
    const isEvmWallet =
      walletProvider.id &&
      (walletProvider.id === "injected" ||
        walletProvider.id === "metaMask" ||
        walletProvider.id === "walletConnect" ||
        walletProvider.name?.toLowerCase().includes("metamask") ||
        walletProvider.name?.toLowerCase().includes("wallet connect") ||
        // Check if it has EVM-specific stub methods that throw EVM-related errors
        (walletProvider.signPsbt &&
          walletProvider.signPsbt
            .toString()
            .includes("PSBT signing not supported for EVM wallets")));

    // Handle different wallet types
    if (walletProvider.id === "near-wallet") {
      // Near wallets are handled by the StepOne component directly
      return;
    } else if (isEvmWallet) {
      // EVM wallets are already connected through wagmi in ConnectModal
      // Just trigger the wallet connected callback
      console.log("EVM wallet connected:", walletProvider.name);
    } else {
      // For BTC wallets, use the existing BTC connect handler
      handleConnectBTC(walletProvider);
    }
  };

  // Show loading while app is initializing or checking status
  // Also show loading if wallet is connected but we haven't checked status yet
  if (
    !isMounted ||
    isCheckingStatus ||
    (walletAddress && !hasCheckedInitialStatus)
  ) {
    return (
      <OnboardingLayout currentStep={1}>
        <div className="max-w-md mx-auto text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
          <p className="text-neutral-6 dark:text-neutral-4">
            {!isMounted ? "Initializing..." : "Checking onboarding status..."}
          </p>
          {statusCheckError && (
            <p className="text-yellow-500 text-sm mt-2">{statusCheckError}</p>
          )}
        </div>
      </OnboardingLayout>
    );
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepOne
            onConnect={handleConnectWallet}
            onWalletConnected={handleWalletConnected}
            connectDisabled={!!walletAddress}
            address={walletAddress}
          />
        );
      case 2:
        return (
          <StepTwo
            socialTasks={socialTasks}
            onUpdateTask={updateSocialTask}
            onAccessAtlas={handleAccessAtlas}
            loading={loading}
            accessAtlasLoading={isAccessAtlasLoading}
            allTasksCompleted={allSocialTasksCompleted}
            address={walletAddress}
            onLogout={handleLogout}
            walletType={walletType}
          />
        );
      default:
        return null;
    }
  };

  return (
    <OnboardingLayout currentStep={currentStep}>
      {statusCheckError && !isCheckingStatus && (
        <div className="max-w-md mx-auto mb-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-yellow-700 dark:text-yellow-300 text-sm">
              {statusCheckError}
            </p>
          </div>
        </div>
      )}
      {renderCurrentStep()}
    </OnboardingLayout>
  );
}
