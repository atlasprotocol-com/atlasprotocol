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
  status?: "complete" | "incomplete" | "api_error" | "not_found" | string; // API response status
}

export interface SocialTasks {
  followedX: boolean;
  joinedDiscord: boolean;
  retweetedPost: boolean;
}

const ONBOARDING_API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/v1`;

// Shared redirect control to prevent infinite loops
class RedirectController {
  private static instance: RedirectController;
  private lastRedirectTime: number = 0;
  private currentChecks: Map<string, Promise<OnboardingStatus>> = new Map(); // Per-address checks
  private redirectInProgress: boolean = false;

  static getInstance(): RedirectController {
    if (!RedirectController.instance) {
      RedirectController.instance = new RedirectController();
    }
    return RedirectController.instance;
  }

  canRedirect(): boolean {
    const now = Date.now();
    const timeSinceLastRedirect = now - this.lastRedirectTime;
    return timeSinceLastRedirect >= 3000 && !this.redirectInProgress; // Increased to 3 seconds
  }

  setRedirectInProgress(inProgress: boolean): void {
    this.redirectInProgress = inProgress;
    if (inProgress) {
      this.lastRedirectTime = Date.now();
    }
  }

  setCurrentCheck(
    address: string,
    check: Promise<OnboardingStatus> | null,
  ): void {
    if (check) {
      this.currentChecks.set(address, check);
    } else {
      this.currentChecks.delete(address);
    }
  }

  getCurrentCheck(address: string): Promise<OnboardingStatus> | null {
    return this.currentChecks.get(address) || null;
  }

  clearAllState(): void {
    this.currentChecks.clear();
    this.redirectInProgress = false;
    // Don't reset lastRedirectTime to prevent rapid redirects
  }

  reset(): void {
    this.currentChecks.clear();
    this.redirectInProgress = false;
    this.lastRedirectTime = 0;
  }
}

class OnboardingApiService {
  private storageKey = "atlas_onboarding_status";
  private redirectController = RedirectController.getInstance();

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
      // Re-throw the original axios error to preserve response information
      // This allows callers to check status codes and response data
      throw error;
    }
  }

  // Check if address has completed onboarding via real API with deduplication
  async checkOnboardingStatus(
    address: string,
    fromPage?: "home" | "onboarding",
  ): Promise<OnboardingStatus> {
    // If there's already a check in progress, return that result
    const currentCheck = this.redirectController.getCurrentCheck(address);
    if (currentCheck) {
      console.log(
        `Deduplicating onboarding check for ${address} from ${fromPage}`,
      );
      return currentCheck;
    }

    const checkPromise = this._performOnboardingCheck(address, fromPage);
    this.redirectController.setCurrentCheck(address, checkPromise);

    try {
      const result = await checkPromise;
      return result;
    } finally {
      // Clear the current check after completion
      setTimeout(() => {
        this.redirectController.setCurrentCheck(address, null);
      }, 500);
    }
  }

  private async _performOnboardingCheck(
    address: string,
    fromPage?: "home" | "onboarding",
  ): Promise<OnboardingStatus> {
    try {
      console.log(
        `Checking onboarding status for ${address} from ${fromPage} page`,
      );

      const response = await this.makeApiCall(
        "GET",
        "/onboarding/status",
        undefined,
        { walletAddress: address },
      );

      const data = response.data.data;

      // Map API response to our interface
      const isCompleted = data.status === "complete";

      const result = {
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

      console.log(`Onboarding status result for ${address}:`, result);
      return result;
    } catch (error) {
      console.error(
        `Failed to check onboarding status for ${address} from ${fromPage}:`,
        error,
      );

      // Check if this is a 404 "Wallet address not found" error
      const isAxiosError = axios.isAxiosError(error);
      const is404NotFound =
        isAxiosError &&
        error.response?.status === 404 &&
        error.response?.data?.error === "Wallet address not found";

      if (is404NotFound) {
        console.log(
          `📍 Wallet ${address} not found (404) - wallet has not completed onboarding yet`,
        );

        // For both HOME and ONBOARDING pages: 404 means onboarding is not complete
        // HOME page will redirect to onboarding, ONBOARDING page will continue flow
        return {
          address,
          isCompleted: false,
          completedSteps: {
            walletConnected: true,
            socialTasksCompleted: false,
            emailSubmitted: false,
          },
          status: "not_found", // Special status to indicate wallet not found
        };
      }

      // For other API errors (network, server errors, etc.)
      // For the HOME page: if API fails, assume user can stay (don't force redirect)
      // For the ONBOARDING page: if API fails, continue with onboarding flow
      const fallbackCompleted = fromPage === "home" ? true : false;

      console.log(
        `API error - setting fallback isCompleted to ${fallbackCompleted} for ${fromPage} page`,
      );

      return {
        address,
        isCompleted: fallbackCompleted,
        completedSteps: {
          walletConnected: true,
          socialTasksCompleted: fallbackCompleted,
          emailSubmitted: fallbackCompleted,
        },
        status: "api_error",
      };
    }
  }

  // Check if a redirect can be performed (prevents infinite loops)
  canPerformRedirect(): boolean {
    return this.redirectController.canRedirect();
  }

  // Mark that a redirect is in progress
  setRedirectInProgress(inProgress: boolean): void {
    this.redirectController.setRedirectInProgress(inProgress);
  }

  // Submit email via real API
  async submitEmail(email: string): Promise<void> {
    try {
      await this.makeApiCall("POST", "/onboarding/submit-email", { email });
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

    // Update social tasks completion - only require first two tasks (Follow X and Join Discord)
    // The RT task is optional
    const requiredTasksCompleted = tasks.followedX && tasks.joinedDiscord;
    currentStatus.completedSteps.socialTasksCompleted = requiredTasksCompleted;

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

      // Clear any cached status for this address to force fresh check
      this.clearCachedStatus(address);

      // Brief delay to ensure API propagation before redirect
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      throw error;
    }
  }

  // Clear cached status for an address (forces fresh API check)
  clearCachedStatus(address: string): void {
    this.redirectController.setCurrentCheck(address, null);
  }

  // Clear all redirect state (for wallet disconnections)
  clearAllRedirectState(): void {
    this.redirectController.clearAllState();
  }

  // Reset redirect controller (for manual navigation)
  resetRedirectController(): void {
    this.redirectController.reset();
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
  }

  // Debug method to check current localStorage data
  getStoredData(): Record<string, OnboardingStatus> {
    const storedData = localStorage.getItem(this.storageKey);
    return storedData ? JSON.parse(storedData) : {};
  }
}

export const onboardingApi = new OnboardingApiService();
