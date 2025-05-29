// Real API service for onboarding status
// Updated to use actual Atlas Protocol API endpoints

import axios from "axios";

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
  status?: string; // API response status
}

export interface SocialTasks {
  followedX: boolean;
  joinedDiscord: boolean;
  retweetedPost: boolean;
}

const ONBOARDING_API_BASE_URL = "https://api-uat.atlasprotocol.com/api/v1";

class OnboardingApiService {
  private storageKey = "atlas_onboarding_status";

  // Helper method to make API calls with consistent error handling
  private async makeApiCall(
    method: "GET" | "POST",
    endpoint: string,
    data?: any,
    params?: any,
  ) {
    try {
      const config = {
        method,
        url: `${ONBOARDING_API_BASE_URL}${endpoint}`,
        headers: {
          "Content-Type": "application/json",
        },
        ...(method === "POST" && data ? { data } : {}),
        ...(method === "GET" && params ? { params } : {}),
      };

      const response = await axios(config);
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error?.response?.data?.message || error.message;
        throw new Error(message);
      } else {
        throw new Error("API request failed");
      }
    }
  }

  // Check if address has completed onboarding via real API
  async checkOnboardingStatus(address: string): Promise<OnboardingStatus> {
    try {
      const response = await this.makeApiCall(
        "GET",
        "/onboarding/status",
        undefined,
        { walletAddress: address },
      );

      const data = response.data;

      // Map API response to our interface
      const isCompleted = data.status === "complete";

      return {
        address,
        isCompleted,
        completedSteps: {
          walletConnected: true, // If we're checking, wallet is already connected
          socialTasksCompleted: isCompleted, // Assume social tasks are done if completed
          emailSubmitted: isCompleted, // Assume email is submitted if completed
        },
        status: data.status,
        completedAt: data.completedAt,
      };
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      // Fallback to not completed on error
      return {
        address,
        isCompleted: false,
        completedSteps: {
          walletConnected: true,
          socialTasksCompleted: false,
          emailSubmitted: false,
        },
      };
    }
  }

  // Submit email via real API
  async submitEmail(email: string): Promise<void> {
    try {
      await this.makeApiCall("POST", "/onboarding/submit-email", { email });
      console.log("Email submitted successfully:", email);
    } catch (error) {
      console.error("Failed to submit email:", error);
      throw error;
    }
  }

  // Update onboarding status to complete via real API
  async updateOnboardingStatus(
    address: string,
    status: string = "complete",
  ): Promise<void> {
    try {
      await this.makeApiCall("POST", "/onboarding/update-status", {
        walletAddress: address,
        status,
      });
      console.log("Onboarding status updated successfully:", address, status);
    } catch (error) {
      console.error("Failed to update onboarding status:", error);
      throw error;
    }
  }

  // Mock API call to update social tasks completion (keep for now until real endpoint exists)
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

  // Complete onboarding - updated to use real APIs
  async completeOnboarding(address: string, email: string): Promise<void> {
    try {
      // If email is provided, submit it first
      if (email.trim()) {
        await this.submitEmail(email);
      }

      // Always update the onboarding status to complete
      await this.updateOnboardingStatus(address, "complete");

      console.log("Onboarding completed successfully for address:", address);
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      throw error;
    }
  }

  // Clear onboarding data (for testing)
  async clearOnboardingData(): Promise<void> {
    localStorage.removeItem(this.storageKey);
  }

  // Clear onboarding data for a specific address
  async clearOnboardingDataForAddress(address: string): Promise<void> {
    const storedData = localStorage.getItem(this.storageKey);
    const allStatuses: Record<string, OnboardingStatus> = storedData
      ? JSON.parse(storedData)
      : {};

    // Remove only the specific address
    delete allStatuses[address];

    // Save back to localStorage
    localStorage.setItem(this.storageKey, JSON.stringify(allStatuses));
    console.log("Cleared onboarding data for address:", address);
  }

  // Debug method to check current localStorage data
  getStoredData(): Record<string, OnboardingStatus> {
    const storedData = localStorage.getItem(this.storageKey);
    return storedData ? JSON.parse(storedData) : {};
  }
}

export const onboardingApi = new OnboardingApiService();
