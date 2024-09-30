"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { networks } from "bitcoinjs-lib";
import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import { network } from "@/config/network.config";
import { calculateStakingHistoriesDiff } from "@/utils/local_storage/calculateStakingHistoriesDiff";
import { getStakingHistoriesLocalStorageKey } from "@/utils/local_storage/getStakingHistoriesLocalStorageKey";
import { WalletError, WalletErrorType } from "@/utils/wallet/errors";
import {
  getPublicKeyNoCoord,
  isSupportedAddressType,
  toNetwork,
} from "@/utils/wallet/index";
import { Network, WalletProvider } from "@/utils/wallet/wallet_provider";

import {
  PaginatedStakingHistories,
  getStakingHistories,
} from "./api/getStakingHistories";
import { Footer } from "./components/Footer/Footer";
import { Header } from "./components/Header/Header";
import { ConnectModal } from "./components/Modals/ConnectModal";
import { ErrorModal } from "./components/Modals/ErrorModal";
import { TermsModal } from "./components/Modals/Terms/TermsModal";
import { Staking } from "./components/Staking/Staking";
import { StakingHistories } from "./components/StakingHistory/StakingHistories";
import { Stats } from "./components/Stats/Stats";
import { Summary } from "./components/Summary/Summary";
import Tabs from "./components/Tabs/Tabs";
import { useError } from "./context/Error/ErrorContext";
import { useTerms } from "./context/Terms/TermsContext";
import { ErrorHandlerParam, ErrorState } from "./types/errors";
import { Stakes } from "./types/stakes";

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const [btcWallet, setBTCWallet] = useState<WalletProvider | undefined>();
  const [btcWalletBalanceSat, setBTCWalletBalanceSat] = useState<number>(0);
  const [btcWalletNetwork, setBTCWalletNetwork] = useState<
    networks.Network | undefined
  >();
  const [publicKeyNoCoord, setPublicKeyNoCoord] = useState<string>("");
  const [isLoadingCurrentParams, setIsLoadingCurrentParams] = useState(false);

  const [address, setAddress] = useState<string>("");
  const { error, isErrorOpen, showError, hideError, retryErrorAction } =
    useError();
  const { isTermsOpen, closeTerms } = useTerms();

  const {
    data: stakingHistories,
    fetchNextPage: fetchNextStakingHistoriesPage,
    hasNextPage: hasNextStakingHistoriesPage,
    isFetchingNextPage: isFetchingNextStakingHistoriesPage,
    error: stakingHistoriesError,
    isError: hasStakingHistoriesError,
    refetch: refetchStakingHistoriesData,
  } = useInfiniteQuery({
    queryKey: ["stakingHistories", address, publicKeyNoCoord],
    queryFn: ({ pageParam = "" }) => getStakingHistories(pageParam, address),
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.next_key !== ""
        ? lastPage?.pagination?.next_key
        : null,
    initialPageParam: "",
    refetchInterval: 2000,
    enabled: !!(btcWallet && publicKeyNoCoord && address),
    select: (data) => {
      const flattenedData = data.pages.reduce<PaginatedStakingHistories>(
        (acc, page) => {
          acc.stakingHistories.push(...page.stakingHistories);
          acc.pagination = page.pagination;
          return acc;
        },
        { stakingHistories: [], pagination: { next_key: "" } },
      );

      return flattenedData;
    },
    retry: (failureCount, error) => {
      return !isErrorOpen && failureCount <= 3;
    },
  });

  const stakingHistoriesLocalStorageKey =
    getStakingHistoriesLocalStorageKey(publicKeyNoCoord);

  const [stakingHistoriesLocalStorage, setStakingHistoriesLocalStorage] =
    useLocalStorage<Stakes[]>(stakingHistoriesLocalStorageKey, []);

  useEffect(() => {
    const handleError = ({
      error,
      hasError,
      errorState,
      refetchFunction,
    }: ErrorHandlerParam) => {
      if (hasError && error) {
        showError({
          error: {
            message: error.message,
            errorState: errorState,
            errorTime: new Date(),
          },
          retryAction: refetchFunction,
        });
      }
    };
  }, [showError]);

  const [connectModalOpen, setConnectModalOpen] = useState<boolean>(false);

  const handleConnectModal = () => {
    setConnectModalOpen(true);
  };

  const handleDisconnectBTC = () => {
    setBTCWallet(undefined);
    setBTCWalletBalanceSat(0);
    setBTCWalletNetwork(undefined);
    setPublicKeyNoCoord("");
    setAddress("");
  };

  const handleConnectBTC = async (walletProvider: WalletProvider) => {
    setConnectModalOpen(false);

    try {
      await walletProvider.connectWallet();
      const address = await walletProvider.getAddress();
      const supported = isSupportedAddressType(address);

      if (!supported) {
        throw new Error(
          "Invalid address type. Please use a Native SegWit or Taproot address.",
        );
      }

      const balanceSat = await walletProvider.getBalance();
      const publicKeyNoCoord = getPublicKeyNoCoord(
        await walletProvider.getPublicKeyHex(),
      );
      setBTCWallet(walletProvider);
      setBTCWalletBalanceSat(balanceSat);
      setBTCWalletNetwork(toNetwork(await walletProvider.getNetwork()));
      setAddress(address);
      setPublicKeyNoCoord(publicKeyNoCoord.toString("hex"));
    } catch (error: any) {
      if (
        error instanceof WalletError &&
        error.getType() === WalletErrorType.ConnectionCancelled
      ) {
        return;
      }
      showError({
        error: {
          message: error.message,
          errorState: ErrorState.WALLET,
          errorTime: new Date(),
        },
        retryAction: () => handleConnectBTC(walletProvider),
      });
    }
  };

  useEffect(() => {
    if (btcWallet) {
      let once = false;
      btcWallet.on("accountChanged", () => {
        if (!once) {
          handleConnectBTC(btcWallet);
        }
      });
      return () => {
        once = true;
      };
    }
  }, [btcWallet]);

  // Clean up the local storage staking
  useEffect(() => {
    if (!stakingHistories?.stakingHistories) {
      return;
    }

    const updateStakingHistoriesLocalStorage = async () => {
      const {
        areStakingHistoriesDifferent,
        stakingHistories: newStakingHistories,
      } = await calculateStakingHistoriesDiff(
        stakingHistories.stakingHistories,
        stakingHistoriesLocalStorage,
      );
      if (areStakingHistoriesDifferent) {
        setStakingHistoriesLocalStorage(newStakingHistories);
      }
    };

    updateStakingHistoriesLocalStorage();
  }, [
    stakingHistories,
    setStakingHistoriesLocalStorage,
    stakingHistoriesLocalStorage,
  ]);

  
  let totalStakedSat = 0;
  let totalRedeemedSat = 0;

  if (stakingHistories) {
    totalStakedSat = stakingHistories.stakingHistories.reduce(
      (accumulator: number, item) => accumulator + item?.btcAmount,
      0,
    );
  }

  return (
    <main
      className={`relative h-full min-h-svh w-full ${network === Network.MAINNET ? "main-app-mainnet" : "main-app-testnet"}`}
    >
      {/* <NetworkBadge /> */}
      <Header
        onConnect={handleConnectModal}
        onDisconnect={handleDisconnectBTC}
        address={address}
        balanceSat={btcWalletBalanceSat}
      />
      <div className="container mx-auto flex justify-center p-6">
        <div className="container flex flex-col gap-6">
          <Stats />
          {address && (
            <Summary
              address={address}
              totalStakedSat={totalStakedSat}
              totalRedeemedSat={totalRedeemedSat}
              balanceSat={btcWalletBalanceSat}
            />
          )}

   
            <div>
              <Staking
                isWalletConnected={!!btcWallet}
                onConnect={handleConnectModal}
                isLoading={isLoadingCurrentParams}
                btcWallet={btcWallet}
                btcWalletBalanceSat={btcWalletBalanceSat}
                btcWalletNetwork={btcWalletNetwork}
                address={address}
                publicKeyNoCoord={publicKeyNoCoord}
              />
              {btcWallet && stakingHistories && btcWalletNetwork && (
                <div className="mt-6">
                  <StakingHistories
                    stakingHistoriesAPI={stakingHistories.stakingHistories}
                    stakingHistoriesLocalStorage={stakingHistoriesLocalStorage}
                    queryMeta={{
                      next: fetchNextStakingHistoriesPage,
                      hasMore: hasNextStakingHistoriesPage,
                      isFetchingMore: isFetchingNextStakingHistoriesPage,
                    }}
                  />
                </div>
              )}
            </div>
          
        </div>
      </div>
      <Footer />
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
  );
};

export default Home;
