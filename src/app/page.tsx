"use client";

import { useRouter } from "next/navigation";
import React, { Suspense, useContext, useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import Wallet from "sats-connect";

import { onboardingApi } from "@/app/onboarding/services/onboardingApi";
import { uuidService } from "@/app/onboarding/services/uuidService";
import { network } from "@/config/network.config";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useConnectBTCWallet } from "@/hooks/useConnectBTCWallet";
import { useEvmWallet } from "@/utils/evm_wallet/wallet_provider";
import { NearContext } from "@/utils/near";
import { Network } from "@/utils/wallet/wallet_provider";

import { Card } from "./components/Card";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Holdings } from "./components/Holdings";
import { ConnectModal } from "./components/Modals/ConnectModal";
import { ErrorModal } from "./components/Modals/ErrorModal";
import { TermsModal } from "./components/Modals/Terms/TermsModal";
import { RequireConnectWallet } from "./components/RequireConnectWallet";
import { LoadingSpinner } from "./components/Spinner";
import { Stats } from "./components/Stats/Stats";
import {
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from "./components/Tabs";
import { TooltipProvider } from "./components/Tooltip";
import { useError } from "./context/Error/ErrorContext";
import { useTerms } from "./context/Terms/TermsContext";
import { AppContext, defaultAppContext } from "./context/app";

interface HomeProps {}

function LoadingSection() {
  return (
    <div className="flex justify-center items-center h-96 w-full flex-1">
      <LoadingSpinner />
    </div>
  );
}

const LazyStake = React.lazy(() =>
  import("./components/Stake").then((mod) => ({ default: mod.Stake })),
);
const LazyRedeem = React.lazy(() =>
  import("./components/Redeem").then((mod) => ({ default: mod.Redeem })),
);
const LazyBridge = React.lazy(() =>
  import("./components/Bridge").then((mod) => ({ default: mod.Bridge })),
);
// const LazyPoints = React.lazy(() =>
//   import("./components/Points").then((mod) => ({ default: mod.Points })),
// );

const LazyReward = React.lazy(() =>
  import("./components/Reward").then((mod) => ({ default: mod.Reward })),
);

const LazyStakeHistory = React.lazy(() =>
  import("./components/History").then((mod) => ({ default: mod.StakeHistory })),
);

const LazyRedeemHistory = React.lazy(() =>
  import("./components/History/RedeemHistory").then((mod) => ({
    default: mod.RedeemHistory,
  })),
);

const LazyBridgeHistory = React.lazy(() =>
  import("./components/History/BridgeHistory").then((mod) => ({
    default: mod.BridgeHistorySection,
  })),
);

const Home: React.FC<HomeProps> = () => {
  const [connectModalOpen, setConnectModalOpen] = useState<boolean>(false);

  const {
    address: btcAddress,
    publicKeyNoCoord,
    publicKeyHex,
    btcWallet,
    btcWalletBalanceSat,
    btcWalletNetwork,
    handleConnectBTC,
    handleDisconnectBTC,
    formattedBalance,
    refetchBalance,
    manualMinusBalance,
    isConnecting,
  } = useConnectBTCWallet({
    onSuccessfulConnect: () => {
      setConnectModalOpen(false);
    },
  });

  // Add EVM and Near wallet support
  const { evmAddress } = useEvmWallet();
  const { signedAccountId: nearAddress } = useContext(NearContext);

  // Create unified wallet address (same logic as onboarding page)
  const btcWalletAddress =
    btcAddress ||
    (typeof window !== "undefined" && (window as any).unisat?.address);
    
  // Debug wallet connection state
  useEffect(() => {
    console.log(`🔍 [Homepage] Wallet state debug:`, {
      btcAddress,
      unisatAddress: typeof window !== "undefined" ? (window as any).unisat?.address : null,
      btcWalletAddress,
      evmAddress,
      nearAddress,
      isConnecting
    });
  }, [btcAddress, btcWalletAddress, evmAddress, nearAddress, isConnecting]);

  const { error, isErrorOpen, showError, hideError, retryErrorAction } =
    useError();
  const { isTermsOpen, closeTerms } = useTerms();

  const handleConnectModal = () => {
    setConnectModalOpen(true);
  };

  const [tabValue, setTabValue] = React.useState<string | null>(null);

  const { match: isDesktop, isReady: isBreakpointReady } = useBreakpoint("lg");

  useEffect(() => {
    if (tabValue) {
      localStorage.setItem("ATLAS_MAIN_TAB", tabValue);
    }
  }, [tabValue]);

  useEffect(() => {
    const savedTab = localStorage.getItem("ATLAS_MAIN_TAB");

    setTabValue(savedTab || "stake");
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (btcWalletAddress) {
      timer = setInterval(() => {
        refetchBalance();
      }, 15000);
    }
    return () => clearInterval(timer);
  }, [btcWalletAddress, refetchBalance]);

  const handleGetInfo = async () => {
    try {
      const response1 = await Wallet.request("wallet_connect", null);
      console.log(response1);
      // await Wallet.request("wallet_connect", null);
      const response = await Wallet.request("wallet_getAccount", null);

      console.log(response);
    } catch (err) {
      console.log(err);
    }
  };

  const router = useRouter();

  // Handle browser navigation (back/forward buttons) to reset redirect state
  useEffect(() => {
    const handlePopState = () => {
      console.log("Browser navigation detected, resetting redirect state");
      onboardingApi.resetRedirectController();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Track wallet initialization state
  const [hasInitializedWalletCheck, setHasInitializedWalletCheck] = useState(false);
  const [isFromOnboardingRedirect, setIsFromOnboardingRedirect] = useState(false);

  // Check if we're coming from onboarding redirect
  useEffect(() => {
    // Check if there was a recent redirect from onboarding
    const redirectInProgress = typeof window !== 'undefined' && 
      sessionStorage.getItem('onboarding_redirect_timestamp');
    
    if (redirectInProgress) {
      const timestamp = parseInt(redirectInProgress, 10);
      const timeSinceRedirect = Date.now() - timestamp;
      
      // If redirect was within last 2 seconds, we're likely coming from onboarding
      if (timeSinceRedirect < 2000) {
        console.log('🚀 [Homepage] Detected recent onboarding redirect, allowing extra wallet detection time');
        setIsFromOnboardingRedirect(true);
        // Clear the flag after use
        sessionStorage.removeItem('onboarding_redirect_timestamp');
      }
    }
  }, []);

  // Allow wallet providers to initialize before checking onboarding
  useEffect(() => {
    const initDelay = isFromOnboardingRedirect ? 1000 : 500; // More time if from redirect
    
    const timer = setTimeout(() => {
      setHasInitializedWalletCheck(true);
    }, initDelay);
    
    return () => clearTimeout(timer);
  }, [isFromOnboardingRedirect]);

  // Check onboarding status when any wallet address changes (UUID-aware)
  useEffect(() => {
    // Don't check until wallet providers have had time to initialize
    if (isConnecting || !hasInitializedWalletCheck) {
      return;
    }

    const checkOnboarding = async () => {
      // Get wallet address with same priority as onboarding: BTC → NEAR → EVM
      const walletAddress = btcWalletAddress || nearAddress || evmAddress;

      console.log(`🔍 [Homepage] Wallet detection - BTC: ${!!btcWalletAddress}, NEAR: ${!!nearAddress}, EVM: ${!!evmAddress}`);
      console.log(`🔍 [Homepage] Selected wallet: ${walletAddress || 'none'}`);

      // If no wallet is connected, check UUID first before redirecting
      if (!walletAddress) {
        try {
          // Check if UUID has completed onboarding (handles redirect from onboarding page)
          const uuid = uuidService.getCurrentUUID();
          if (uuid) {
            console.log(`🔗 [Homepage] No wallet detected, checking UUID: ${uuid}`);
            const hasCompletedOnboarding = await uuidService.hasCompletedOnboarding(uuid);
            
            if (hasCompletedOnboarding) {
              console.log(`✅ [Homepage] UUID has completed onboarding, staying on homepage (wallet will connect soon)`);
              
              // Try to detect and reconnect BTC wallet if it exists but isn't connected
              if (typeof window !== "undefined" && (window as any).unisat?.address) {
                console.log(`🔗 [Homepage] Detected Unisat wallet, attempting to reconnect...`);
                
                // Check if we have the wallet name in localStorage, if not set it
                const connectedWallet = localStorage.getItem("ATLAS_CONNECTED_WALLET");
                if (!connectedWallet) {
                  localStorage.setItem("ATLAS_CONNECTED_WALLET", "Unisat");
                  console.log(`🔗 [Homepage] Set ATLAS_CONNECTED_WALLET for existing Unisat connection`);
                  
                  // Force a page refresh to let useConnectBTCWallet pick up the localStorage
                  setTimeout(() => {
                    window.location.reload();
                  }, 100);
                  return;
                }
              }
              
              return; // Stay on homepage, wallet detection will trigger soon
            }
          }
        } catch (uuidError) {
          console.warn("⚠️ [Homepage] Failed to check UUID:", uuidError);
        }

        console.log("👤 [Homepage] No wallet connected and no completed UUID, redirecting to onboarding");
        if (onboardingApi.canPerformRedirect()) {
          onboardingApi.setRedirectInProgress(true);
          router.replace("/onboarding");
        }
        return;
      }

      // Check if we can perform a redirect (prevents rapid redirects)
      if (!onboardingApi.canPerformRedirect()) {
        console.log("⚠️ [Homepage] Redirect throttled, skipping onboarding check");
        return;
      }

      try {
        console.log(`🔍 [Homepage] Checking onboarding status for: ${walletAddress}`);
        
        // Check current wallet's onboarding status
        const status = await onboardingApi.checkOnboardingStatus(
          walletAddress,
          "home",
        );
        
        console.log(`📊 [Homepage] Onboarding status:`, status);

        // If current wallet has completed onboarding, allow access
        if (status.isCompleted && status.status !== "api_error") {
          console.log(`✅ [Homepage] Current wallet completed onboarding, staying on homepage`);
          return;
        }

        // Check UUID-linked wallets for completed onboarding
        try {
          const uuid = uuidService.getCurrentUUID();
          if (uuid) {
            console.log(`🔗 [Homepage] Checking linked wallets for UUID: ${uuid}`);
            const hasCompletedOnboarding = await uuidService.hasCompletedOnboarding(uuid);
            
            if (hasCompletedOnboarding) {
              console.log(`✅ [Homepage] Linked wallet has completed onboarding, staying on homepage`);
              return;
            }
          }
        } catch (uuidError) {
          console.warn("⚠️ [Homepage] Failed to check UUID linked wallets:", uuidError);
          // Continue with fallback logic
        }

        // If no completed onboarding found and no API error, redirect to onboarding
        if (status.status !== "api_error") {
          console.log("❌ [Homepage] No completed onboarding found, redirecting to onboarding");
          onboardingApi.setRedirectInProgress(true);
          router.replace("/onboarding");
        } else {
          console.log("⚠️ [Homepage] API error - staying on homepage as fallback");
        }
      } catch (error) {
        console.error("❌ [Homepage] Error checking onboarding status:", error);
        // On error, stay on homepage (don't force redirect)
        console.log("⚠️ [Homepage] API error - staying on homepage");
      }
    };

    // Add delay to allow wallet state to settle after initialization
    const timeoutId = setTimeout(checkOnboarding, 200);
    return () => clearTimeout(timeoutId);
  }, [router, isConnecting, btcWalletAddress, evmAddress, nearAddress, hasInitializedWalletCheck]);

  return (
    <AppContext.Provider
      value={{
        ...defaultAppContext,
        btcWallet,
        btcAddress: btcAddress,
        btcPublicKeyNoCoord: publicKeyNoCoord,
        btcPublicKeyHex: publicKeyHex,
        btcNetwork: btcWalletNetwork,
        btcRefreshBalance: refetchBalance,
        btcManualMinusBalance: manualMinusBalance,
      }}
    >
      <TooltipProvider>
        <main
          className={`relative h-full min-h-svh w-full ${network === Network.MAINNET ? "main-app-mainnet" : "main-app-testnet"}`}
        >
          <Header
            onConnect={handleConnectModal}
            onDisconnect={handleDisconnectBTC}
            address={btcWalletAddress}
            balanceSat={btcWalletBalanceSat}
          />
          <div className="container mx-auto flex justify-center py-6">
            <div className="container flex flex-col gap-6">
              <div className="flex gap-4 flex-col lg:flex-row">
                <div className="flex-1 flex flex-col gap-4">
                  <Stats />
                  {/* <button onClick={handleGetInfo}>Get Info</button> */}
                  <Card>
                    <div
                      className={`py-6 ${
                        isBreakpointReady ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <TabsRoot
                        defaultValue="stake"
                        dirDisplay={isDesktop ? "vertical" : "horizontal"}
                        onValueChange={(value) => setTabValue(value)}
                        value={tabValue || ""}
                      >
                        <TabsList>
                          <TabsTrigger value="stake">Stake</TabsTrigger>
                          <TabsTrigger value="redeem">Redeem</TabsTrigger>
                          <TabsTrigger value="bridging">Bridge</TabsTrigger>
                          <TabsTrigger value="reward">Rewards</TabsTrigger>
                          {/* <TabsTrigger value="points">Points</TabsTrigger> */}
                        </TabsList>
                        <Suspense fallback={<LoadingSection />}>
                          <TabsContent value="stake">
                            <RequireConnectWallet
                              required={!btcWalletAddress}
                              onConnect={handleConnectModal}
                              renderContent={
                                <LazyStake
                                  btcWallet={btcWallet}
                                  formattedBalance={formattedBalance}
                                  btcBalanceSat={btcWalletBalanceSat}
                                />
                              }
                            />
                          </TabsContent>
                          <TabsContent value="redeem">
                            <RequireConnectWallet
                              required={!btcWalletAddress}
                              onConnect={handleConnectModal}
                              renderContent={
                                <LazyRedeem btcAddress={btcAddress} />
                              }
                            />
                          </TabsContent>
                        </Suspense>
                        <TabsContent value="bridging">
                          <LazyBridge />
                        </TabsContent>
                        <TabsContent value="reward">
                          <RequireConnectWallet
                            required={!btcWalletAddress}
                            onConnect={handleConnectModal}
                            renderContent={<LazyReward />}
                          />
                        </TabsContent>
                        {/* <TabsContent value="points">
                        <LazyPoints />
                      </TabsContent> */}
                      </TabsRoot>
                    </div>
                  </Card>
                </div>
                {btcWallet && (
                  <div className="flex-shrink-0 lg:w-[400px] lg:h-full">
                    <Holdings balanceSat={btcWalletBalanceSat} />
                  </div>
                )}
              </div>

              <div>
                <Suspense fallback={<LoadingSection />}>
                  {tabValue === "stake" && <LazyStakeHistory />}

                  {tabValue === "redeem" && <LazyRedeemHistory />}

                  {tabValue === "bridging" && <LazyBridgeHistory />}
                </Suspense>
              </div>
            </div>
          </div>

          <ConnectModal
            open={connectModalOpen}
            onClose={setConnectModalOpen}
            onConnect={handleConnectBTC}
            connectDisabled={!!btcWalletAddress}
          />
          <ErrorModal
            open={isErrorOpen}
            errorMessage={error.message}
            errorState={error.errorState}
            errorTime={error.errorTime}
            onClose={hideError}
            onRetry={retryErrorAction}
          />
          <TermsModal open={isTermsOpen} onClose={closeTerms} />
        </main>
      </TooltipProvider>
      <Footer />
      <ToastContainer />
    </AppContext.Provider>
  );
};

export default Home;

export const dynamic = "force-dynamic";
