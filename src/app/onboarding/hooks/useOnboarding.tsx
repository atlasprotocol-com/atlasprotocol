"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  onboardingApi,
  OnboardingStatus,
  SocialTasks,
} from "../services/onboardingApi";

export type OnboardingStep = 1 | 2 | 3;

interface UseOnboardingProps {
  address?: string;
}

export const useOnboarding = ({ address }: UseOnboardingProps) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [loading, setLoading] = useState(false);
  const [onboardingStatus, setOnboardingStatus] =
    useState<OnboardingStatus | null>(null);
  const [socialTasks, setSocialTasks] = useState<SocialTasks>({
    followedX: false,
    joinedDiscord: false,
    retweetedPost: false,
  });

  // Check onboarding status when address changes
  useEffect(() => {
    if (address) {
      checkOnboardingStatus();
    }
  }, [address]);

  const checkOnboardingStatus = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    try {
      const status = await onboardingApi.checkOnboardingStatus(address);
      setOnboardingStatus(status);

      // If already completed, redirect to home
      if (status.isCompleted) {
        router.replace("/");
        return;
      }

      // Determine current step based on completion status
      if (!status.completedSteps.walletConnected) {
        setCurrentStep(1);
      } else if (!status.completedSteps.socialTasksCompleted) {
        setCurrentStep(2);
      } else if (!status.completedSteps.emailSubmitted) {
        setCurrentStep(3);
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
    } finally {
      setLoading(false);
    }
  }, [address, router]);

  const handleWalletConnected = useCallback(() => {
    // After wallet is connected, move to step 2
    setCurrentStep(2);
  }, []);

  const updateSocialTask = useCallback(
    (task: keyof SocialTasks, completed: boolean) => {
      setSocialTasks((prev) => ({
        ...prev,
        [task]: completed,
      }));
    },
    [],
  );

  const handleSocialTasksComplete = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    try {
      await onboardingApi.updateSocialTasks(address, socialTasks);
      setCurrentStep(3);
    } catch (error) {
      console.error("Failed to update social tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [address, socialTasks]);

  const handleCompleteOnboarding = useCallback(
    async (email: string) => {
      if (!address) return;

      setLoading(true);
      try {
        await onboardingApi.completeOnboarding(address, email);
        // Redirect to home after completion
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

  return {
    currentStep,
    loading,
    onboardingStatus,
    socialTasks,
    allSocialTasksCompleted,
    updateSocialTask,
    handleWalletConnected,
    handleSocialTasksComplete,
    handleCompleteOnboarding,
    checkOnboardingStatus,
  };
};
