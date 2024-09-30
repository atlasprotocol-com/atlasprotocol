import { useQuery } from "@tanstack/react-query";
import { networks } from "bitcoinjs-lib";
import { useEffect, useMemo, useState } from "react";
import { Tooltip } from "react-tooltip";
import { useLocalStorage } from "usehooks-ts";

import { LoadingView } from "@/app/components/Loading/Loading";
import { useError } from "@/app/context/Error/ErrorContext";
import { useGlobalParams } from "@/app/context/api/GlobalParamsProvider";
import { useStakingStats } from "@/app/context/api/StakingStatsProvider";
import { ErrorHandlerParam, ErrorState } from "@/app/types/errors";
import {
  createStakingTx,
  signStakingTx,
} from "@/utils/delegations/signStakingTx";
import { getFeeRateFromMempool } from "@/utils/getFeeRateFromMempool";
import { isStakingSignReady } from "@/utils/isStakingSignReady";
import { WalletProvider } from "@/utils/wallet/wallet_provider";
import { useChainConfig } from "@/app/context/api/ChainConfigProvider"; 

import { FeedbackModal } from "../Modals/FeedbackModal";
import { PreviewModal } from "../Modals/PreviewModal";
import { WalletNotConnected } from "../States/WalletNotConnected";

import { StakingAmount } from "./Form/StakingAmount";
import { StakingReceiving } from "./Form/StakingReceiving";

interface StakingProps {
  isWalletConnected: boolean;
  isLoading: boolean;
  onConnect: () => void;
  btcWallet: WalletProvider | undefined;
  btcWalletBalanceSat: number;
  btcWalletNetwork: networks.Network | undefined;
  address: string | undefined;
  publicKeyNoCoord: string;
}

export const Staking: React.FC<StakingProps> = ({
  isWalletConnected,
  onConnect,
  isLoading,
  btcWallet,
  btcWalletNetwork,
  address,
  publicKeyNoCoord,
  btcWalletBalanceSat,
}) => {
  const { chainConfigs } = useChainConfig(); // Get the chain configurations from context
  
  const [totalTVLSat, setTotalTVLSat] = useState(0);
  const [stakingCap, setStakingCap] = useState(0);

  // Staking form state
  const stakingStatsProvider = useStakingStats();
  const [stakingAmountSat, setStakingAmountSat] = useState(0);
  const [stakingReceivingAddress, setStakingReceivingAddress] = useState("");
  const [stakingReceivingChain, setStakingReceivingChain] = useState("");
  const [stakingReceivingChainID, setStakingReceivingChainID] = useState("");
  // Selected fee rate, comes from the user input
  const [selectedFeeRate, setSelectedFeeRate] = useState(0);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [resetFormInputs, setResetFormInputs] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{
    type: "success" | "cancel" | null;
    isOpen: boolean;
  }>({ type: null, isOpen: false });
  const [successFeedbackModalOpened, setSuccessFeedbackModalOpened] =
    useLocalStorage<boolean>("bbn-staking-successFeedbackModalOpened", false);
  const [cancelFeedbackModalOpened, setCancelFeedbackModalOpened] =
    useLocalStorage<boolean>("bbn-staking-cancelFeedbackModalOpened ", false);

  // Mempool fee rates, comes from the network
  // Fetch fee rates, sat/vB
  const {
    data: mempoolFeeRates,
    error: mempoolFeeRatesError,
    isError: hasMempoolFeeRatesError,
    refetch: refetchMempoolFeeRates,
  } = useQuery({
    queryKey: ["mempool fee rates"],
    queryFn: async () => {
      if (btcWallet?.getNetworkFees) {
        return await btcWallet.getNetworkFees();
      }
    },
    enabled: !!btcWallet?.getNetworkFees,
    refetchInterval: 60000, // 1 minute
    retry: (failureCount) => {
      return !isErrorOpen && failureCount <= 3;
    },
  });

  // Fetch all UTXOs
  const {
    data: availableUTXOs,
    error: availableUTXOsError,
    isError: hasAvailableUTXOsError,
    refetch: refetchAvailableUTXOs,
  } = useQuery({
    queryKey: ["available UTXOs", address],
    queryFn: async () => {
      if (btcWallet?.getUtxos && address) {
        return await btcWallet.getUtxos(address);
      }
    },
    enabled: !!(btcWallet?.getUtxos && address),
    refetchInterval: 60000 * 5, // 5 minutes
    retry: (failureCount) => {
      return !isErrorOpen && failureCount <= 3;
    },
  });

  // load global params
  const globalParams = useGlobalParams();

  const { isErrorOpen, showError } = useError();

  useEffect(() => {
    if (stakingStatsProvider.data) {
      setTotalTVLSat(stakingStatsProvider.data.totalTVLSat);
    }

    if (globalParams.data && globalParams.data.length > 0) {
      setStakingCap(globalParams.data[0].stakingCapSat);
    }
  }, [globalParams, stakingStatsProvider]);

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
            errorState,
            errorTime: new Date(),
          },
          retryAction: refetchFunction,
        });
      }
    };

    handleError({
      error: mempoolFeeRatesError,
      hasError: hasMempoolFeeRatesError,
      errorState: ErrorState.SERVER_ERROR,
      refetchFunction: refetchMempoolFeeRates,
    });
    handleError({
      error: availableUTXOsError,
      hasError: hasAvailableUTXOsError,
      errorState: ErrorState.SERVER_ERROR,
      refetchFunction: refetchAvailableUTXOs,
    });
  }, [
    availableUTXOsError,
    mempoolFeeRatesError,
    hasMempoolFeeRatesError,
    hasAvailableUTXOsError,
    refetchMempoolFeeRates,
    refetchAvailableUTXOs,
    showError,
  ]);

  const handleResetState = () => {
    setStakingAmountSat(0);
    setSelectedFeeRate(0);
    setStakingReceivingAddress("");
    setStakingReceivingChain("");
    setStakingReceivingChainID("");
    setPreviewModalOpen(false);
    setResetFormInputs(!resetFormInputs);
  };

  const { minFeeRate, defaultFeeRate } = getFeeRateFromMempool(mempoolFeeRates);

  // Either use the selected fee rate or the fastest fee rate
  const feeRate = selectedFeeRate || defaultFeeRate;

  

  const handleSign = async () => {
    try {
      // Initial validation
      if (!btcWallet) throw new Error("Wallet is not connected");
      if (!address) throw new Error("Address is not set");
      if (!btcWalletNetwork) throw new Error("Wallet network is not connected");
      if (!stakingReceivingAddress)
        throw new Error("Receiving address not set");
      if (!stakingReceivingChain) throw new Error("Receiving chain not set");

      if (!feeRate) throw new Error("Fee rates not loaded");
      if (!availableUTXOs || availableUTXOs.length === 0)
        throw new Error("No available balance");

      // check that selected Fee rate (if present) is bigger than the min fee
      if (!globalParams.data) {
        throw new Error("Global param no loaded.");
      }

      if (!feeRate) throw new Error("Fee rates not loaded");


      const { atlasAddress } = globalParams.data[0];
      console.log(atlasAddress);
      //Sign the staking transaction
      const { stakingTxHex } = await signStakingTx(
        btcWallet,
        stakingAmountSat,
        atlasAddress,
        btcWalletNetwork,
        address,
        publicKeyNoCoord,
        feeRate,
        availableUTXOs,
        `${stakingReceivingChainID},${stakingReceivingAddress}`,
      );

      // UI
      handleFeedbackModal("success");
      handleResetState();
    } catch (error: Error | any) {
      showError({
        error: {
          message: error.message,
          errorState: ErrorState.STAKING,
          errorTime: new Date(),
        },
        retryAction: handleSign,
      });
    }
  };

  // Memoize the staking fee calculation
  const stakingFeeSat = useMemo(() => {
    if (
      btcWalletNetwork &&
      address &&
      publicKeyNoCoord &&
      stakingAmountSat &&
      mempoolFeeRates &&
      availableUTXOs
    ) {
      try {
        // check that selected Fee rate (if present) is bigger than the min fee
        if (selectedFeeRate && selectedFeeRate < minFeeRate) {
          throw new Error("Selected fee rate is lower than the hour fee");
        }

        // check that selected Fee rate (if present) is bigger than the min fee
        if (!globalParams.data) {
          throw new Error("Global param no loaded.");
        }

        const memoizedFeeRate = selectedFeeRate || defaultFeeRate;
        //Calculate the staking fee
        const { atlasAddress } = globalParams.data[0];

        const { stakingFeeSat } = createStakingTx(
          stakingAmountSat,
          atlasAddress,
          btcWalletNetwork,
          address,
          publicKeyNoCoord,
          memoizedFeeRate,
          availableUTXOs,
          `${stakingReceivingChainID},${stakingReceivingAddress}`,
        );

        return stakingFeeSat;
        return 1;
      } catch (error: Error | any) {
        // fees + staking amount can be more than the balance
        showError({
          error: {
            message: error.message,
            errorState: ErrorState.STAKING,
            errorTime: new Date(),
          },
          retryAction: () => setSelectedFeeRate(0),
        });
        setSelectedFeeRate(0);
        return 0;
      }
    } else {
      return 0;
    }
  }, [
    btcWalletNetwork,
    address,
    publicKeyNoCoord,
    stakingAmountSat,
    mempoolFeeRates,
    availableUTXOs,
    selectedFeeRate,
    minFeeRate,
    globalParams.data,
    defaultFeeRate,
    stakingReceivingChainID,
    stakingReceivingAddress,
    showError,
  ]);

  const handleStakingAmountSatChange = (inputAmountSat: number) => {
    setStakingAmountSat(inputAmountSat);
  };

  const handleStakingRecivingAddressChange = (
    inputReceivingAddress: string,
  ) => {
    setStakingReceivingAddress(inputReceivingAddress);
  };

  const handleStakingRecivingChainChange = (
    inputReceivingChainID: string,
    inputReceivingChain: string,
  ) => {
    setStakingReceivingChainID(inputReceivingChainID);
    setStakingReceivingChain(inputReceivingChain);
  };

  // Show feedback modal only once for each type
  const handleFeedbackModal = (type: "success" | "cancel") => {
    // if (!feedbackModal.isOpen && feedbackModal.type !== type) {
    //   const isFeedbackModalOpened =
    //     type === "success"
    //       ? successFeedbackModalOpened
    //       : cancelFeedbackModalOpened;
    //   if (!isFeedbackModalOpened) {
    //     setFeedbackModal({ type, isOpen: true });
    //   }
    //}
    setFeedbackModal({ type, isOpen: true });
  };

  const handlePreviewModalClose = (isOpen: boolean) => {
    setPreviewModalOpen(isOpen);
    handleFeedbackModal("cancel");
  };

  const handleCloseFeedbackModal = () => {
    if (feedbackModal.type === "success") {
      setSuccessFeedbackModalOpened(true);
    } else if (feedbackModal.type === "cancel") {
      setCancelFeedbackModalOpened(true);
    }
    setFeedbackModal({ type: null, isOpen: false });
  };

  const renderStakingForm = () => {
    // States of the staking form:
    // 1. Wallet is not connected
    if (!isWalletConnected) {
      return <WalletNotConnected onConnect={onConnect} />;
    }
    // 2. Wallet is connected but we are still loading the staking params
    else if (isLoading || globalParams.isLoading) {
      return <LoadingView />;
    } else if (globalParams.data) {
      const { minStakingAmountSat, maxStakingAmountSat, atlasAddress } =
        globalParams.data[0];

      // Check if the staking transaction is ready to be signed
      const chainConfig = chainConfigs ? chainConfigs[stakingReceivingChainID] : null;

      const { isReady: signReady, reason: signNotReadyReason } =
        isStakingSignReady(
          minStakingAmountSat,
          maxStakingAmountSat,
          stakingAmountSat,
          stakingCap,
          totalTVLSat,
          stakingReceivingAddress,
          chainConfig?.networkType || ''
        );

      const previewReady =
        signReady &&
        feeRate &&
        availableUTXOs &&
        stakingAmountSat &&
        stakingReceivingAddress &&
        stakingReceivingChainID !== "" &&
        atlasAddress

      return (
        <>
          <div className="flex flex-row space-x-4">
            {/* Step 1: Staking Amount */}
            <div className="flex flex-1 flex-col">
              <p className="mb-4">Step 1:</p>
              <StakingAmount
                minStakingAmountSat={minStakingAmountSat}
                maxStakingAmountSat={maxStakingAmountSat}
                btcWalletBalanceSat={btcWalletBalanceSat}
                onStakingAmountSatChange={handleStakingAmountSatChange}
                reset={resetFormInputs}
              />
            </div>

            {/* Step 2: Select Chain and Address */}
            <div className="flex flex-1 flex-col">
              <p className="mb-4">Step 2: </p>
              <StakingReceiving
                onStakingAddressChange={handleStakingRecivingAddressChange}
                onStakingChainChange={handleStakingRecivingChainChange}
                reset={resetFormInputs}
              />
            </div>

            {/* Step 3: Review and Preview */}
            <div className="flex flex-1 flex-col">
              <p className="mb-9">Step 3:</p>
              <span
                className="cursor-pointer text-xs"
                data-tooltip-id="tooltip-staking-preview"
                data-tooltip-content={signNotReadyReason}
                data-tooltip-place="top"
              >
                <button
                  className="btn-primary btn mt-2 w-full"
                  disabled={!previewReady}
                  onClick={() => setPreviewModalOpen(true)}
                >
                  Review
                </button>
                <Tooltip id="tooltip-staking-preview" />
              </span>
              {previewReady && (
                <PreviewModal
                  open={previewModalOpen}
                  onClose={handlePreviewModalClose}
                  onSign={handleSign}
                  stakingAmountSat={stakingAmountSat}
                  stakingFeeSat={stakingFeeSat}
                  stakingReceivingChain={stakingReceivingChain}
                  stakingReceivingAddress={stakingReceivingAddress}
                  feeRate={feeRate}
                />
              )}
            </div>
          </div>
        </>
      );
    }
  };

  return (
    <div className="card flex flex-col gap-2 bg-base-300 p-4 shadow-sm lg:flex-1 relative">
      <h3 className="mb-4 font-bold">Staking</h3>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-col gap-4 lg:basis-2/5 xl:basis-1/3">
          {renderStakingForm()}
        </div>
      </div>
      <FeedbackModal
        open={feedbackModal.isOpen}
        onClose={handleCloseFeedbackModal}
        type={feedbackModal.type}
      />
    </div>
  );
};
