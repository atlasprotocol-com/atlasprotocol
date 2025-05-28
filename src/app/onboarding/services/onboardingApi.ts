// Mock API service for onboarding status
// This will be replaced with real API endpoints later

export interface OnboardingStatus {
  address: string;
  isCompleted: boolean;
  completedSteps: {
    walletConnected: boolean;
    socialTasksCompleted: boolean;
    emailSubmitted: boolean;
  };
  email?: string;
  completedAt?: string;
}

export interface SocialTasks {
  followedX: boolean;
  joinedDiscord: boolean;
  retweetedPost: boolean;
}

class OnboardingApiService {
  private storageKey = "atlas_onboarding_status";

  // Mock API call to check if address has completed onboarding
  async checkOnboardingStatus(address: string): Promise<OnboardingStatus> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    const storedData = localStorage.getItem(this.storageKey);
    const allStatuses: Record<string, OnboardingStatus> = storedData
      ? JSON.parse(storedData)
      : {};

    const status = allStatuses[address] || {
      address,
      isCompleted: false,
      completedSteps: {
        walletConnected: true, // If we're checking, wallet is already connected
        socialTasksCompleted: false,
        emailSubmitted: false,
      },
    };

    return status;
  }

  // Mock API call to update social tasks completion
  async updateSocialTasks(address: string, tasks: SocialTasks): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const storedData = localStorage.getItem(this.storageKey);
    const allStatuses: Record<string, OnboardingStatus> = storedData
      ? JSON.parse(storedData)
      : {};

    const currentStatus = allStatuses[address] || {
      address,
      isCompleted: false,
      completedSteps: {
        walletConnected: true,
        socialTasksCompleted: false,
        emailSubmitted: false,
      },
    };

    // Update social tasks completion
    const allTasksCompleted =
      tasks.followedX && tasks.joinedDiscord && tasks.retweetedPost;
    currentStatus.completedSteps.socialTasksCompleted = allTasksCompleted;

    allStatuses[address] = currentStatus;
    localStorage.setItem(this.storageKey, JSON.stringify(allStatuses));
  }

  // Mock API call to submit email and complete onboarding
  async completeOnboarding(address: string, email: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const storedData = localStorage.getItem(this.storageKey);
    const allStatuses: Record<string, OnboardingStatus> = storedData
      ? JSON.parse(storedData)
      : {};

    const currentStatus = allStatuses[address] || {
      address,
      isCompleted: false,
      completedSteps: {
        walletConnected: true,
        socialTasksCompleted: false,
        emailSubmitted: false,
      },
    };

    // Mark onboarding as completed
    currentStatus.completedSteps.emailSubmitted = true;
    currentStatus.completedSteps.socialTasksCompleted = true; // Ensure social tasks are marked as completed
    currentStatus.isCompleted = true;

    // Only set email if provided (user clicked Subscribe vs Access Atlas)
    if (email.trim()) {
      currentStatus.email = email;
    }

    currentStatus.completedAt = new Date().toISOString();

    allStatuses[address] = currentStatus;
    localStorage.setItem(this.storageKey, JSON.stringify(allStatuses));

    console.log("Onboarding completion saved to localStorage:", currentStatus);
  }

  // Clear onboarding data (for testing)
  async clearOnboardingData(): Promise<void> {
    localStorage.removeItem(this.storageKey);
  }

  // Debug method to check current localStorage data
  getStoredData(): Record<string, OnboardingStatus> {
    const storedData = localStorage.getItem(this.storageKey);
    return storedData ? JSON.parse(storedData) : {};
  }
}

export const onboardingApi = new OnboardingApiService();
