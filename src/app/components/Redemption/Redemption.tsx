import { useCallback, useEffect, useMemo, useState } from "react";
import { Tooltip } from "react-tooltip";
import { useLocalStorage } from "usehooks-ts";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";

import { LoadingView } from "@/app/components/Loading/Loading";
import { useError } from "@/app/context/Error/ErrorContext";
import { useGlobalParams } from "@/app/context/api/GlobalParamsProvider";
import { useTokenBalance } from "@/app/hooks";
import { ErrorState } from "@/app/types/errors";
import { useChainConfig } from "@/app/context/api/ChainConfigProvider";
import { isRedemptionSignReady } from "@/utils/isRedemptionSignReady";
import { useEvmWallet } from "@/utils/evm_wallet/wallet_provider";

import { ConnectEvmWalletModal } from "../Modals/ConnectEvmWalletModal"; // Import ConnectEvmWalletModal
import { FeedbackModal } from "../Modals/FeedbackModal";
import { RedemptionPreviewModal } from "../Modals/RedemptionPreviewModal";
import { WalletNotConnected } from "../States/WalletNotConnected";

import { RedemptionAmount } from "./Form/RedemptionAmount";
import { RedemptionReceiving } from "./Form/RedemptionReceiving";



interface RedemptionProps {
  isWalletConnected: boolean;
  isLoading: boolean;
  onConnect: () => void;
  address: string | undefined;
}

export const Redemption: React.FC<RedemptionProps> = ({
  isWalletConnected,
  isLoading,
  onConnect,
  address,
}) => {
  const [redemptionAmountSat, setRedemptionAmountSat] = useState(0);
  const [redemptionChain, setRedemptionChain] = useState("");
  const [redemptionChainID, setRedemptionChainID] = useState("");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [resetFormInputs, setResetFormInputs] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{
    type: "success" | "cancel" | null;
    isOpen: boolean;
  }>({ type: null, isOpen: false });
  const [successFeedbackModalOpened, setSuccessFeedbackModalOpened] =
    useLocalStorage<boolean>(
      "bbn-redemption-successFeedbackModalOpened",
      false,
    );
  const [cancelFeedbackModalOpened, setCancelFeedbackModalOpened] =
    useLocalStorage<boolean>("bbn-redemption-cancelFeedbackModalOpened", false);
  const [isEvmWalletModalOpen, setIsEvmWalletModalOpen] = useState(false);

  const { evmAddress, gasPrice, estimatedGas, fetchGasDetails, burnRedeem } =
    useEvmWallet();

  const { chainId: currentChainId } = useAccount();

   // Use ChainConfig from the context instead of getChainConfig
  const { chainConfigs, loading: chainConfigsLoading } = useChainConfig();

  const selectedaBTCChain = useMemo(() => {
    if (redemptionChainID && chainConfigs) {
      const chainConfig = chainConfigs[redemptionChainID];
      return {
        chainID: Number(chainConfig?.chainID),
        chainName: redemptionChain,
        chainRpcUrl: chainConfig?.chainRpcUrl,
        aBTCAddress: chainConfig?.aBTCAddress,
      };
    }
  }, [redemptionChainID, chainConfigs, redemptionChain]);

  const { data: aBTCBalance, refetch: refetchaBTCBalance } = useTokenBalance({
    tokenAddress: selectedaBTCChain?.aBTCAddress,
    chainId: selectedaBTCChain?.chainID,
  });

  const { switchChainAsync } = useSwitchChain();
  const { disconnectAsync, isPending: isDisconnecting } = useDisconnect();

  const globalParams = useGlobalParams();
  const { isErrorOpen, showError } = useError();

  const fetchGasDetailsAsync = useCallback(
    async ({
      chainId,
      amount,
      btcAddress,
    }: {
      chainId: string;
      amount: number;
      btcAddress: string;
    }) => {
      await fetchGasDetails(chainId, amount, btcAddress);
    },
    [fetchGasDetails],
  );

  const handleRedemptionChainChange = async (
    inputRedemptionChainID: string,
  ) => {
    if (!chainConfigs) {
      return;
    }
    const chainConfig = chainConfigs[inputRedemptionChainID];
   
    setRedemptionChain(chainConfig?.networkName || "");
    setRedemptionChainID(chainConfig?.chainID || "");

    try {
      if (chainConfig?.networkType === "EVM") {
        if (evmAddress && address) {
          console.log("Switching chain...");
          await switchChainAsync({
            chainId: Number(chainConfig?.chainID || 0),
          });
        } else {
          setIsEvmWalletModalOpen(true);
        }
      }
    } catch (error: Error | any) {
      setRedemptionChain("");
      setRedemptionChainID("");
      showError({
        error: {
          message: error.message,
          errorState: ErrorState.WALLET,
          errorTime: new Date(),
        },
        retryAction: () => handleRedemptionChainChange(inputRedemptionChainID),
      });
    }
  };
  useEffect(() => {
    if (evmAddress && redemptionChainID) {
      fetchGasDetailsAsync({
        chainId: redemptionChainID,
        amount: redemptionAmountSat,
        btcAddress: evmAddress,
      });
    }
  }, [
    evmAddress,
    fetchGasDetailsAsync,
    redemptionAmountSat,
    redemptionChainID,
  ]);

  useEffect(() => {
    const current = currentChainId?.toString() || "";
    if (current && current !== redemptionChainID && !redemptionChainID && chainConfigs) {
      const chainConfig = chainConfigs[current];
      setRedemptionChain(chainConfig?.networkName || "");
      setRedemptionChainID(chainConfig?.chainID || "");
    }
  }, [currentChainId, redemptionChainID, chainConfigs]);
  
  const handleRedemptionAmountChange = (inputAmountSat: number) => {
    setRedemptionAmountSat(inputAmountSat);
  };

  const handleDisconnect = async () => {
    await disconnectAsync();
    setRedemptionChain("");
    setRedemptionChainID("");
  };

  const handleSign = async () => {
    try {
      if (!redemptionChain && !redemptionChainID) {
        throw new Error("Redemption chain not selected");
      }
      await burnRedeem(redemptionChainID, redemptionAmountSat, address || "");
      handleFeedbackModal("success");
      handleResetState();
      refetchaBTCBalance();
    } catch (error: Error | any) {
      console.error(error);
      showError({
        error: {
          message: error.message || error?.error?.message,
          errorState: ErrorState.WITHDRAW,
          errorTime: new Date(),
        },
        retryAction: handleSign,
      });
    }
  };

  const handleResetState = () => {
    setRedemptionAmountSat(0);
    setPreviewModalOpen(false);
    setResetFormInputs(!resetFormInputs);
  };

  // Show feedback modal only once for each type
  const handleFeedbackModal = (type: "success" | "cancel") => {
    // if (!feedbackModal.isOpen && feedbackModal.type !== type) {
    //   const isFeedbackModalOpened =
    //     type === "success"
    //       ? successFeedbackModalOpened
    //       : cancelFeedbackModalOpened;
    //   if (!isFeedbackModalOpened) {
        
    //   }
    // }
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

  const renderRedemptionForm = () => {
    if (!isWalletConnected || !address) {
      return <WalletNotConnected onConnect={onConnect} />;
    } else if (isLoading || globalParams.isLoading || chainConfigsLoading) {
      return <LoadingView />;
    } else if (globalParams.data) {
      const { minStakingAmountSat } = globalParams.data[0];

      // Check if the staking transaction is ready to be signed
      const { isReady: signReady, reason: signNotReadyReason } =
        isRedemptionSignReady(
          minStakingAmountSat,
          Number(aBTCBalance?.value || 0),
          redemptionAmountSat,
        );

      const previewReady =
        signReady &&
        evmAddress &&
        redemptionAmountSat > 0 &&
        redemptionAmountSat <= Number(aBTCBalance?.value || 0) &&
        redemptionChain &&
        gasPrice;

      // Calculate redemption fee
      const redemptionFee =
        gasPrice && estimatedGas ? gasPrice * estimatedGas : 0;

      return (
        <>
          <div className="flex flex-row space-x-4">
            <div className="flex flex-1 flex-col">
              <p className="mb-4">Step 1:</p>
              <RedemptionAmount
                minStakingAmountSat={minStakingAmountSat}
                onRedemptionAmountChange={handleRedemptionAmountChange}
                onRedemptionChainChange={handleRedemptionChainChange}
                selectedChain={redemptionChainID}
                reset={resetFormInputs}
                address={evmAddress}
                formattedBalance={aBTCBalance?.formatted}
                balance={aBTCBalance?.value ? Number(aBTCBalance.value) : 0}
                onDisconnect={handleDisconnect}
                isDisconnecting={isDisconnecting}
              />
            </div>

            <div className="flex flex-1 flex-col">
              <p className="mb-4">Step 2: </p>
              <RedemptionReceiving redemptionAddress={address} />
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
                <RedemptionPreviewModal
                  open={previewModalOpen}
                  onClose={handlePreviewModalClose}
                  onSign={handleSign}
                  redemptionAmountSat={redemptionAmountSat}
                  redemptionFee={redemptionFee}
                  redemptionChain={redemptionChain}
                  redemptionReceivingAddress={address}
                  feeRate={gasPrice || 0}
                  redemptionAddress={evmAddress || ""}
                />
              )}
            </div>
          </div>
        </>
      );
    }
  };

  return (
    <div className="card flex flex-col gap-2 bg-base-300 p-4 shadow-sm lg:flex-1">
      <h3 className="mb-4 font-bold">Redemption</h3>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-col gap-4 lg:basis-2/5 xl:basis-1/3">
          {renderRedemptionForm()}
        </div>
      </div>
      <FeedbackModal
        open={feedbackModal.isOpen}
        onClose={handleCloseFeedbackModal}
        type={feedbackModal.type}
      />
    
      <ConnectEvmWalletModal
        isOpen={isEvmWalletModalOpen}
        onClose={(success) => {
          setIsEvmWalletModalOpen(false);
          if (!success) {
            handleDisconnect();
            setRedemptionChain("");
            setRedemptionChainID("");
          }
        }}
        selectedChain={redemptionChain} // Pass the selected chain name
        selectedChainID={redemptionChainID} // Pass the selected chain ID
      />
    </div>
  );
};

