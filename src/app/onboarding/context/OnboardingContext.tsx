"use client";

import { useConnectBTCWallet } from "@/hooks/useConnectBTCWallet";
import { useEvmWallet } from "@/utils/evm_wallet/wallet_provider";
import { NearContext } from "@/utils/near";
import { WalletProvider } from "@/utils/wallet/wallet_provider";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useDisconnect } from "wagmi";

import { onboardingApi, SocialTasks } from "../services/onboardingApi";
import { uuidService } from "../services/uuidService";

export type OnboardingStep = 1 | 2;
export type WalletType = "BTC" | "NEAR" | "EVM" | null;

interface LinkedWallet {
  address: string;
  type: WalletType;
  isOnboardingComplete: boolean;
}

interface OnboardingState {
  // Core state
  currentStep: OnboardingStep;
  loading: boolean;
  isInitialized: boolean;
  
  // Wallet state
  connectedWallet: string | null; // Just the address string
  walletType: WalletType;
  linkedWallets: LinkedWallet[];
  
  // Individual wallet addresses for future use
  btcAddress: string | null;
  evmAddress: string | null;
  nearAddress: string | null;
  
  // Social tasks
  socialTasks: SocialTasks;
  allSocialTasksCompleted: boolean;
  
  // Status checks
  isCheckingStatus: boolean;
  statusCheckError: string | null;
  hasCheckedInitialStatus: boolean;
  
  // Loading states
  isAccessAtlasLoading: boolean;
}

interface OnboardingContextType extends OnboardingState {
  // Wallet management
  connectWallet: (walletProvider: WalletProvider) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  
  // Social tasks
  updateSocialTask: (task: keyof SocialTasks, completed: boolean) => void;
  
  // Onboarding flow
  completeOnboarding: () => Promise<void>;
  
  // Utils
  refreshOnboardingStatus: () => Promise<void>;
  resetOnboarding: () => void;
  
  // Debug utilities
  forceRefreshOnboardingStatus: () => Promise<void>;
  debugInfo: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const router = useRouter();
  const { signedAccountId: nearAddress, wallet: nearWallet } = useContext(NearContext);
  const { evmAddress, setIsManualConnected } = useEvmWallet();
  const { disconnect: disconnectEvm } = useDisconnect();

  // BTC wallet hook
  const {
    address: btcAddress,
    handleConnectBTC,
    handleDisconnectBTC,
  } = useConnectBTCWallet({
    onSuccessfulConnect: () => {
      console.log("BTC Wallet connected successfully");
    },
  });

  // Get BTC address from hook + direct window access
  const btcWalletAddress = btcAddress || (typeof window !== "undefined" && (window as any).unisat?.address);

  // Core state
  const [state, setState] = useState<OnboardingState>({
    currentStep: 1,
    loading: false,
    isInitialized: false,
    connectedWallet: null,
    walletType: null,
    linkedWallets: [],
    btcAddress: null,
    evmAddress: null,
    nearAddress: null,
    socialTasks: {
      followedX: false,
      joinedDiscord: false,
      retweetedPost: false,
    },
    allSocialTasksCompleted: false,
    isCheckingStatus: false,
    statusCheckError: null,
    hasCheckedInitialStatus: false,
    isAccessAtlasLoading: false,
  });

  // Get current wallet address with priority: BTC → NEAR → EVM
  const getCurrentWalletInfo = useCallback((): { address: string; type: WalletType } | null => {
    if (btcWalletAddress) {
      return { address: btcWalletAddress, type: "BTC" };
    }
    if (nearAddress) {
      return { address: nearAddress, type: "NEAR" };
    }
    if (evmAddress) {
      return { address: evmAddress, type: "EVM" };
    }
    return null;
  }, [btcWalletAddress, nearAddress, evmAddress]);

  // Initialize basic state and UUID
  const initializeOnboarding = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Ensure UUID exists
      const uuid = uuidService.getOrCreateUUID();
      console.log("Onboarding UUID:", uuid);
      
      // Get current wallet info and set basic state
      const currentWallet = getCurrentWalletInfo();
      
      if (currentWallet) {
        // If it's a BTC wallet, ensure localStorage is set for homepage detection
        if (currentWallet.type === "BTC" && typeof window !== "undefined") {
          const existingWallet = localStorage.getItem("ATLAS_CONNECTED_WALLET");
          if (!existingWallet) {
            // Detect which BTC wallet is connected and set localStorage
            if ((window as any).unisat?.address) {
              localStorage.setItem("ATLAS_CONNECTED_WALLET", "Unisat");
              console.log(`🔗 Detected existing Unisat connection, set ATLAS_CONNECTED_WALLET`);
            }
          }
        }
        
        // Set connected wallet state, but keep on step 1 until status check completes
        setState(prev => ({
          ...prev,
          connectedWallet: currentWallet.address,
          walletType: currentWallet.type,
          btcAddress: btcWalletAddress || null,
          evmAddress: evmAddress || null,
          nearAddress: nearAddress || null,
          currentStep: 1, // Will advance to 2 after status check passes
          hasCheckedInitialStatus: false, // Reset to trigger status check
        }));
      } else {
        // No wallet connected, stay on step 1
        console.log(`👤 No wallet connected, showing step 1`);
        setState(prev => ({
          ...prev,
          currentStep: 1,
          connectedWallet: null,
          walletType: null,
          btcAddress: null,
          evmAddress: null,
          nearAddress: null,
        }));
      }
    } catch (error) {
      console.error("❌ Failed to initialize onboarding:", error);
      setState(prev => ({
        ...prev,
        statusCheckError: "Failed to initialize onboarding. Please try again.",
      }));
    } finally {
      setState(prev => ({
        ...prev,
        loading: false,
        isInitialized: true,
      }));
    }
  }, [getCurrentWalletInfo, btcWalletAddress, evmAddress, nearAddress]);

  // Initialize on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeOnboarding();
    }, 100); // Small delay to allow wallet providers to initialize

    return () => clearTimeout(timer);
  }, [initializeOnboarding]);

  // Handle browser navigation (back/forward buttons) to reset redirect state
  useEffect(() => {
    const handlePopState = () => {
      console.log("🔄 Browser navigation detected on onboarding, resetting redirect state");
      onboardingApi.resetRedirectController();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Re-initialize when wallet connection changes
  useEffect(() => {
    if (state.isInitialized) {
      const currentWallet = getCurrentWalletInfo();
      const connectedAddress = state.connectedWallet;
      
      // If wallet changed (connected, disconnected, or switched)
      if (
        (currentWallet?.address !== connectedAddress) ||
        (!currentWallet && connectedAddress) ||
        (currentWallet && !connectedAddress)
      ) {
        console.log("🔄 Wallet connection changed, re-initializing onboarding");
        setState(prev => ({ 
          ...prev, 
          isInitialized: false, 
          hasCheckedInitialStatus: false,
          isCheckingStatus: false,
          currentStep: 1 // Reset to step 1 on wallet change
        }));
        initializeOnboarding();
      }
    }
  }, [btcWalletAddress, nearAddress, evmAddress, state.isInitialized, state.connectedWallet, initializeOnboarding]);

  // 🎯 MAIN LOGIC: Check onboarding status whenever there's a connected wallet
  // This handles both cases: page refresh AND new wallet connection
  useEffect(() => {
    const checkWalletOnboardingStatus = async () => {
      // Only check if we have a wallet, system is initialized, and we haven't checked yet
      if (!state.connectedWallet || !state.isInitialized || state.hasCheckedInitialStatus) {
        return;
      }
      
      console.log(`🔍 Checking onboarding status for wallet: ${state.connectedWallet} (${state.walletType})`);
      
      try {
        setState(prev => ({ ...prev, isCheckingStatus: true, statusCheckError: null }));
        
        // Get UUID for linked wallet checks
        const uuid = uuidService.getOrCreateUUID();
        
        // Check onboarding status for current wallet FIRST
        const status = await onboardingApi.checkOnboardingStatus(state.connectedWallet, "onboarding");
        console.log(`📊 Onboarding status result:`, status);
        
        // If current wallet has completed onboarding, redirect immediately
        if (status.isCompleted && status.status !== "api_error") {
          console.log(`✅ Wallet ${state.connectedWallet} has completed onboarding, redirecting to home`);
          
          // Set flag for homepage to detect onboarding redirect
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('onboarding_redirect_timestamp', Date.now().toString());
          }
          
          // Always try to redirect when onboarding is complete
          onboardingApi.setRedirectInProgress(true);
          router.replace("/");
          return; // Exit early, don't proceed with onboarding
        }
        
        // Check linked wallets and their onboarding status
        const linkedWallets = await uuidService.getLinkedWallets(uuid);
        console.log("🔗 Linked wallets:", linkedWallets);
        
        // Check if current wallet is already linked
        const isWalletLinked = linkedWallets.some(
          wallet => wallet.address.toLowerCase() === state.connectedWallet!.toLowerCase()
        );
        
        if (!isWalletLinked) {
          console.log(`🔗 Linking wallet ${state.connectedWallet} to UUID ${uuid}`);
          await uuidService.linkWalletToUUID(uuid, state.connectedWallet);
          // Refresh linked wallets after linking
          const updatedLinkedWallets = await uuidService.getLinkedWallets(uuid);
          setState(prev => ({ ...prev, linkedWallets: updatedLinkedWallets }));
        } else {
          setState(prev => ({ ...prev, linkedWallets }));
        }
        
        // Check if any other linked wallet has completed onboarding
        const anyLinkedWalletCompleted = linkedWallets.some(wallet => wallet.isOnboardingComplete);
        
        if (anyLinkedWalletCompleted) {
          console.log(`✅ Another linked wallet has completed onboarding, redirecting to home`);
          
          // Set flag for homepage to detect onboarding redirect
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('onboarding_redirect_timestamp', Date.now().toString());
          }
          
          onboardingApi.setRedirectInProgress(true);
          router.replace("/");
          return; // Exit early, don't proceed with onboarding
        }
        
        // If we reach here, proceed with onboarding - advance to step 2
        console.log(`🚀 Proceeding with onboarding for wallet ${state.connectedWallet}`);
        setState(prev => ({
          ...prev,
          currentStep: 2,
          hasCheckedInitialStatus: true,
        }));
        
      } catch (error) {
        console.error("❌ Failed to check onboarding status:", error);
        setState(prev => ({
          ...prev,
          statusCheckError: "Failed to check onboarding status. Please try again.",
          hasCheckedInitialStatus: true,
          currentStep: 2, // Allow user to proceed even if check failed
        }));
      } finally {
        setState(prev => ({ ...prev, isCheckingStatus: false }));
      }
    };
    
    checkWalletOnboardingStatus();
  }, [state.connectedWallet, state.isInitialized, state.hasCheckedInitialStatus, state.walletType, router]);

  // Connect wallet function
  const connectWallet = useCallback(async (walletProvider: WalletProvider) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Handle different wallet types
      if (walletProvider.id === "near-wallet") {
        // Near wallets are handled automatically through NearContext
        return;
      } else if (walletProvider.id === "evm-wallet" || 
                 walletProvider.id === "injected" ||
                 walletProvider.id === "metaMask" ||
                 walletProvider.id === "walletConnect" ||
                 walletProvider.name?.toLowerCase().includes("metamask") ||
                 walletProvider.name?.toLowerCase().includes("wallet connect")) {
        // EVM wallets are handled through wagmi/ConnectModal
        console.log("EVM wallet connected:", walletProvider.name);
      } else {
        // BTC wallets
        await handleConnectBTC(walletProvider);
        
        // IMPORTANT: Set localStorage key for homepage useConnectBTCWallet to detect
        if (walletProvider.name) {
          localStorage.setItem("ATLAS_CONNECTED_WALLET", walletProvider.name);
          console.log(`🔗 Set ATLAS_CONNECTED_WALLET to: ${walletProvider.name}`);
        }
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setState(prev => ({
        ...prev,
        statusCheckError: "Failed to connect wallet. Please try again.",
      }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [handleConnectBTC]);

  // Disconnect wallet function
  const disconnectWallet = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const walletType = state.walletType;
      console.log("Disconnecting wallet type:", walletType);

      if (walletType === "BTC") {
        handleDisconnectBTC();
      } else if (walletType === "NEAR") {
        nearWallet?.signOut();
      } else if (walletType === "EVM") {
        try {
          await disconnectEvm();
        } catch (error) {
          console.log("Disconnect called (might be sync):", error);
        }
        setIsManualConnected(false);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Reset state
      setState(prev => ({
        ...prev,
        currentStep: 1,
        connectedWallet: null,
        walletType: null,
        linkedWallets: [],
        btcAddress: null,
        evmAddress: null,
        nearAddress: null,
        socialTasks: {
          followedX: false,
          joinedDiscord: false,
          retweetedPost: false,
        },
        allSocialTasksCompleted: false,
        statusCheckError: null,
        hasCheckedInitialStatus: false,
      }));

      // Clear API cache and redirect state
      onboardingApi.clearAllRedirectState();
      console.log("Wallet disconnected successfully");
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [state.walletType, handleDisconnectBTC, nearWallet, disconnectEvm, setIsManualConnected]);

  // Update social task
  const updateSocialTask = useCallback((task: keyof SocialTasks, completed: boolean) => {
    setState(prev => {
      const newTasks = {
        ...prev.socialTasks,
        [task]: completed,
      };
      
      // Calculate if all required tasks are completed
      const allCompleted = newTasks.followedX && newTasks.joinedDiscord;
      
      // Update API
      if (prev.connectedWallet) {
        onboardingApi.updateSocialTasks(prev.connectedWallet, newTasks).catch(console.error);
      }
      
      return {
        ...prev,
        socialTasks: newTasks,
        allSocialTasksCompleted: allCompleted,
      };
    });
  }, []);

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    if (!state.connectedWallet) {
      console.error("No wallet address available for onboarding completion");
      return;
    }

    setState(prev => ({ ...prev, isAccessAtlasLoading: true }));
    
    try {
      // Add minimum loading time for better UX
      const [_] = await Promise.all([
        onboardingApi.completeOnboarding(state.connectedWallet, ""),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);

      // Navigate to home page
      router.replace("/");
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      setState(prev => ({
        ...prev,
        statusCheckError: "Failed to complete onboarding. Please try again.",
      }));
      // Still show minimum loading time even on error
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setState(prev => ({ ...prev, isAccessAtlasLoading: false }));
    }
  }, [state.connectedWallet, router]);

  // Refresh onboarding status
  const refreshOnboardingStatus = useCallback(async () => {
    if (!state.connectedWallet) return;

    setState(prev => ({ ...prev, isCheckingStatus: true, statusCheckError: null }));
    
    try {
      const status = await onboardingApi.checkOnboardingStatus(
        state.connectedWallet,
        "onboarding"
      );
      
      if (status.isCompleted && status.status !== "api_error") {
        router.replace("/");
      }
    } catch (error) {
      console.error("Failed to refresh onboarding status:", error);
      setState(prev => ({
        ...prev,
        statusCheckError: "Failed to check onboarding status.",
      }));
    } finally {
      setState(prev => ({ ...prev, isCheckingStatus: false }));
    }
  }, [state.connectedWallet, router]);

  // Reset onboarding (for testing)
  const resetOnboarding = useCallback(() => {
    setState({
      currentStep: 1,
      loading: false,
      isInitialized: false,
      connectedWallet: null,
      walletType: null,
      linkedWallets: [],
      btcAddress: null,
      evmAddress: null,
      nearAddress: null,
      socialTasks: {
        followedX: false,
        joinedDiscord: false,
        retweetedPost: false,
      },
      allSocialTasksCompleted: false,
      isCheckingStatus: false,
      statusCheckError: null,
      hasCheckedInitialStatus: false,
      isAccessAtlasLoading: false,
    });
  }, []);

  // Force refresh onboarding status (for testing)
  const forceRefreshOnboardingStatus = useCallback(async () => {
    console.log("🔄 Force refreshing onboarding status...");
    setState(prev => ({ ...prev, isInitialized: false, hasCheckedInitialStatus: false }));
    await initializeOnboarding();
  }, [initializeOnboarding]);

  // Debug info
  const debugInfo = useCallback(() => {
    console.log("🐛 OnboardingContext Debug Info:", {
      state,
      btcWalletAddress,
      nearAddress,
      evmAddress,
      currentWallet: getCurrentWalletInfo(),
    });
    uuidService.debugInfo();
  }, [state, btcWalletAddress, nearAddress, evmAddress, getCurrentWalletInfo]);

  const contextValue: OnboardingContextType = {
    ...state,
    connectWallet,
    disconnectWallet,
    updateSocialTask,
    completeOnboarding,
    refreshOnboardingStatus,
    resetOnboarding,
    forceRefreshOnboardingStatus,
    debugInfo,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboardingContext = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboardingContext must be used within OnboardingProvider");
  }
  return context;
};