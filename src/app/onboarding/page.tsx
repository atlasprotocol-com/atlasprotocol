"use client";

import { useConnectBTCWallet } from "@/hooks/useConnectBTCWallet";

import { OnboardingLayout } from "./components/OnboardingLayout";
import { StepOne } from "./components/StepOne";
import { StepThree } from "./components/StepThree";
import { StepTwo } from "./components/StepTwo";
import { useOnboarding } from "./hooks/useOnboarding";

export default function OnboardingPage() {
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

  // Debug logging
  console.log("OnboardingPage - address from hook:", address);
  console.log("OnboardingPage - walletAddress:", walletAddress);
  console.log("OnboardingPage - currentStep:", currentStep);
  console.log("OnboardingPage - socialTasks:", socialTasks);
  console.log(
    "OnboardingPage - allSocialTasksCompleted:",
    allSocialTasksCompleted,
  );

  const handleLogout = () => {
    handleDisconnectBTC();
    handleWalletDisconnected();
  };

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
      {renderCurrentStep()}
    </OnboardingLayout>
  );
}
