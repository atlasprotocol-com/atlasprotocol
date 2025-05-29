"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { onboardingApi, SocialTasks } from "../services/onboardingApi";

export type OnboardingStep = 1 | 2 | 3;

interface UseOnboardingProps {
  address?: string;
}

export const useOnboarding = ({ address }: UseOnboardingProps) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    address ? 2 : 1,
  );
  const [loading, setLoading] = useState(false);
  const [socialTasks, setSocialTasks] = useState<SocialTasks>({
    followedX: false,
    joinedDiscord: false,
    retweetedPost: false,
  });

  // Auto-advance to step 2 when wallet becomes connected
  useEffect(() => {
    if (address && currentStep === 1) {
      console.log("Auto-advancing to step 2 - wallet connected:", address);
      setCurrentStep(2);
    }
  }, [address, currentStep]);

  const handleWalletConnected = useCallback(() => {
    setCurrentStep(2);
  }, []);

  const handleWalletDisconnected = useCallback(() => {
    // Reset to step 1 when wallet is disconnected
    setCurrentStep(1);
    // Reset social tasks
    setSocialTasks({
      followedX: false,
      joinedDiscord: false,
      retweetedPost: false,
    });
    // Clear any stored onboarding progress for this specific address
    if (address) {
      onboardingApi.clearOnboardingDataForAddress(address).catch(console.error);
    }
    console.log("Wallet disconnected - reset to step 1");
  }, [address]);

  const updateSocialTask = useCallback(
    async (task: keyof SocialTasks, completed: boolean) => {
      console.log("updateSocialTask called:", task, completed);
      setSocialTasks((prev) => {
        const newTasks = {
          ...prev,
          [task]: completed,
        };
        console.log("updateSocialTask - new state:", newTasks);

        // Update API with new social tasks state
        if (address) {
          onboardingApi
            .updateSocialTasks(address, newTasks)
            .catch(console.error);
        }

        return newTasks;
      });
    },
    [address],
  );

  const handleSocialTasksComplete = useCallback(() => {
    setCurrentStep(3);
  }, []);

  const handleCompleteOnboarding = useCallback(
    async (email: string) => {
      if (!address) {
        console.error("No address available for onboarding completion");
        return;
      }

      setLoading(true);
      try {
        // Call the actual API service to complete onboarding
        await onboardingApi.completeOnboarding(address, email);
        console.log("Onboarding completed successfully for address:", address);

        // Navigate to home page
        router.replace("/");
      } catch (error) {
        console.error("Failed to complete onboarding:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [address, router],
  );

  const allSocialTasksCompleted =
    socialTasks.followedX &&
    socialTasks.joinedDiscord &&
    socialTasks.retweetedPost;

  console.log("useOnboarding - socialTasks:", socialTasks);
  console.log(
    "useOnboarding - allSocialTasksCompleted:",
    allSocialTasksCompleted,
  );

  return {
    currentStep,
    loading,
    socialTasks,
    allSocialTasksCompleted,
    updateSocialTask,
    handleWalletConnected,
    handleWalletDisconnected,
    handleSocialTasksComplete,
    handleCompleteOnboarding,
  };
};
