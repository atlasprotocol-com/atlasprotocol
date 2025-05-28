"use client";

import { useConnectBTCWallet } from "@/hooks/useConnectBTCWallet";

import { OnboardingLayout } from "./components/OnboardingLayout";
import { StepOne } from "./components/StepOne";
import { StepThree } from "./components/StepThree";
import { StepTwo } from "./components/StepTwo";
import { useOnboarding } from "./hooks/useOnboarding";

export default function OnboardingPage() {
  const { address, handleConnectBTC } = useConnectBTCWallet({
    onSuccessfulConnect: () => {
      console.log("Wallet connected successfully");
    },
  });

  const {
    currentStep,
    loading,
    socialTasks,
    allSocialTasksCompleted,
    updateSocialTask,
    handleWalletConnected,
    handleSocialTasksComplete,
    handleCompleteOnboarding,
  } = useOnboarding({ address });

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepOne
            onConnect={handleConnectBTC}
            onWalletConnected={handleWalletConnected}
            connectDisabled={!!address}
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
          />
        );
      case 3:
        return (
          <StepThree onComplete={handleCompleteOnboarding} loading={loading} />
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
