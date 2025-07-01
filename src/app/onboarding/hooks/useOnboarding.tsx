"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { onboardingApi, SocialTasks } from "../services/onboardingApi";

export type OnboardingStep = 1 | 2;

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
      setCurrentStep(2);
    }
  }, [address, currentStep]);

  // Reset to step 1 when wallet becomes disconnected
  useEffect(() => {
    if (!address && currentStep !== 1) {
      setCurrentStep(1);
      // Also reset social tasks when wallet disconnects
      setSocialTasks({
        followedX: false,
        joinedDiscord: false,
        retweetedPost: false,
      });
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
  }, [address]);

  const updateSocialTask = useCallback(
    async (task: keyof SocialTasks, completed: boolean) => {
      setSocialTasks((prev) => {
        const newTasks = {
          ...prev,
          [task]: completed,
        };

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

  const handleSocialTasksComplete = useCallback(async () => {
    if (!address) {
      console.error("No address available for onboarding completion");
      return;
    }

    setLoading(true);
    try {
      // Complete onboarding without email (step 3 removed)
      await onboardingApi.completeOnboarding(address, "");

      // Navigate to home page
      router.replace("/");
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [address, router]);

  // Legacy function - kept for compatibility but now does the same as handleSocialTasksComplete
  const handleCompleteOnboarding = useCallback(
    async (email: string) => {
      // Since step 3 is removed, this is now the same as handleSocialTasksComplete
      await handleSocialTasksComplete();
    },
    [handleSocialTasksComplete],
  );

  // Only require the first two tasks to be completed (Follow X and Join Discord)
  // The RT task is optional
  const requiredSocialTasksCompleted =
    socialTasks.followedX && socialTasks.joinedDiscord;

  // Keep the old name for compatibility but use the new logic
  const allSocialTasksCompleted = requiredSocialTasksCompleted;

  return {
    currentStep,
    loading,
    socialTasks,
    allSocialTasksCompleted,
    requiredSocialTasksCompleted,
    updateSocialTask,
    handleWalletConnected,
    handleWalletDisconnected,
    handleSocialTasksComplete,
    handleCompleteOnboarding,
  };
};
