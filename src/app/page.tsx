"use client";

import { useRouter } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import Wallet from "sats-connect";

import { onboardingApi } from "@/app/onboarding/services/onboardingApi";
import { network } from "@/config/network.config";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useConnectBTCWallet } from "@/hooks/useConnectBTCWallet";
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
    address,
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
    if (address) {
      timer = setInterval(() => {
        refetchBalance();
      }, 15000);
    }
    return () => clearInterval(timer);
  }, [address, refetchBalance]);

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

  // Check onboarding status when address changes
  useEffect(() => {
    if (isConnecting) {
      return;
    }

    console.log("🔄 Address changed:", address);

    const checkOnboarding = async () => {
      // If no wallet is connected, redirect to onboarding
      if (!address) {
        router.push("/onboarding");
        return;
      }

      try {
        // Check if this address has completed onboarding
        const status = await onboardingApi.checkOnboardingStatus(address);

        console.log("🔄 Onboarding status:", status);
        if (!status.isCompleted) {
          router.push("/onboarding");
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        // On error, assume onboarding is needed
        router.push("/onboarding");
      }
    };

    if (!isConnecting) {
      checkOnboarding();
    }
  }, [address, router, isConnecting]);

  return (
    <AppContext.Provider
      value={{
        ...defaultAppContext,
        btcWallet,
        btcAddress: address,
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
            address={address}
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
                          <TabsTrigger value="reward">Reward</TabsTrigger>
                          {/* <TabsTrigger value="points">Points</TabsTrigger> */}
                        </TabsList>
                        <Suspense fallback={<LoadingSection />}>
                          <TabsContent value="stake">
                            <RequireConnectWallet
                              required={!address}
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
                              required={!address}
                              onConnect={handleConnectModal}
                              renderContent={
                                <LazyRedeem btcAddress={address} />
                              }
                            />
                          </TabsContent>
                        </Suspense>
                        <TabsContent value="bridging">
                          <LazyBridge />
                        </TabsContent>
                        <TabsContent value="reward">
                          <RequireConnectWallet
                            required={!address}
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
            connectDisabled={!!address}
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
