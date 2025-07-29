"use client";

import { OnboardingErrorBoundary } from "./components/OnboardingErrorBoundary";
import { OnboardingLayout } from "./components/OnboardingLayout";
import { StepOne } from "./components/StepOne";
import { StepTwo } from "./components/StepTwo";
import {
  OnboardingProvider,
  useOnboardingContext,
} from "./context/OnboardingContext";

const OnboardingPageContent: React.FC = () => {
  const {
    currentStep,
    loading,
    isInitialized,
    connectedWallet,
    walletType,
    socialTasks,
    allSocialTasksCompleted,
    isCheckingStatus,
    statusCheckError,
    hasCheckedInitialStatus,
    isAccessAtlasLoading,
    connectWallet,
    disconnectWallet,
    updateSocialTask,
    completeOnboarding,
  } = useOnboardingContext();

  // Show loading while initializing or checking status
  if (
    !isInitialized ||
    isCheckingStatus ||
    (!hasCheckedInitialStatus && connectedWallet)
  ) {
    const loadingMessage = !isInitialized
      ? "Initializing onboarding..."
      : isCheckingStatus
        ? "Verifying wallet onboarding status..."
        : "Processing wallet connection...";

    return (
      <OnboardingLayout currentStep={1}>
        <div className="max-w-md mx-auto text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
          <p className="text-neutral-6 dark:text-neutral-4">{loadingMessage}</p>
          {connectedWallet && (
            <p className="text-neutral-5 dark:text-neutral-5 text-sm mt-2">
              Wallet: {connectedWallet.slice(0, 8)}...
              {connectedWallet.slice(-6)}
            </p>
          )}
          {isCheckingStatus && (
            <p className="text-blue-500 text-sm mt-2">
              ⚙️ Checking if onboarding is already complete...
            </p>
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
            onConnect={connectWallet}
            onWalletConnected={() => {}} // Context handles this automatically
            connectDisabled={!!connectedWallet}
            address={connectedWallet || undefined}
          />
        );
      case 2:
        return (
          <StepTwo
            socialTasks={socialTasks}
            onUpdateTask={updateSocialTask}
            onAccessAtlas={completeOnboarding}
            loading={loading}
            accessAtlasLoading={isAccessAtlasLoading}
            allTasksCompleted={allSocialTasksCompleted}
            address={connectedWallet || undefined}
            onLogout={disconnectWallet}
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
};

export default function OnboardingPage() {
  return (
    <OnboardingErrorBoundary>
      <OnboardingProvider>
        <OnboardingPageContent />
      </OnboardingProvider>
    </OnboardingErrorBoundary>
  );
}
