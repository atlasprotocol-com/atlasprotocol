"use client";

import { useConnectBTCWallet } from "@/hooks/useConnectBTCWallet";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OnboardingLayout } from "./components/OnboardingLayout";
import { StepOne } from "./components/StepOne";
import { StepThree } from "./components/StepThree";
import { StepTwo } from "./components/StepTwo";
import { useOnboarding } from "./hooks/useOnboarding";
import { onboardingApi } from "./services/onboardingApi";

export default function OnboardingPage() {
  const router = useRouter();
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusCheckError, setStatusCheckError] = useState<string | null>(null);

  const { address, handleConnectBTC, handleDisconnectBTC } =
    useConnectBTCWallet({
      onSuccessfulConnect: () => {
        console.log("Wallet connected successfully");
      },
    });

  // Get address directly from wallet if useConnectBTCWallet doesn't provide it
  const walletAddress =
    address ||
    (typeof window !== "undefined" && (window as any).unisat?.address);

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
  } = useOnboarding({ address: walletAddress });

  // Check if user has already completed onboarding when wallet is connected
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!walletAddress) return;

      setIsCheckingStatus(true);
      setStatusCheckError(null);

      try {
        console.log("Checking onboarding status for address:", walletAddress);
        const status = await onboardingApi.checkOnboardingStatus(walletAddress);
        console.log("Onboarding status check result:", status);

        if (status.isCompleted) {
          console.log(
            "User has already completed onboarding, redirecting to homepage",
          );
          router.replace("/");
          return;
        }
      } catch (error) {
        console.error("Failed to check onboarding status:", error);
        setStatusCheckError(
          "Failed to check onboarding status. Continuing with onboarding flow.",
        );
        // Continue with onboarding flow on error
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkOnboardingStatus();
  }, [walletAddress, router]);

  const handleLogout = () => {
    handleDisconnectBTC();
    handleWalletDisconnected();
    setStatusCheckError(null); // Clear any status check errors
  };

  // Show loading while checking status
  if (isCheckingStatus) {
    return (
      <OnboardingLayout currentStep={currentStep}>
        <div className="max-w-md mx-auto text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
          <p className="text-neutral-6 dark:text-neutral-4">
            Checking onboarding status...
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
            onConnect={handleConnectBTC}
            onWalletConnected={handleWalletConnected}
            connectDisabled={!!address}
            address={walletAddress}
          />
        );
      case 2:
        return (
          <StepTwo
            socialTasks={socialTasks}
            onUpdateTask={updateSocialTask}
            onNext={handleSocialTasksComplete}
            loading={loading}
            allTasksCompleted={allSocialTasksCompleted}
            address={walletAddress}
            onLogout={handleLogout}
          />
        );
      case 3:
        return (
          <StepThree
            onComplete={handleCompleteOnboarding}
            loading={loading}
            address={walletAddress}
            onLogout={handleLogout}
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
