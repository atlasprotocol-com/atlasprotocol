import { zodResolver } from "@hookform/resolvers/zod";
import { SelectValue } from "@radix-ui/react-select";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useLocalStorage } from "usehooks-ts";
import { z } from "zod";

import { useAppContext } from "@/app/context/app";
import {
  useEstGasAtlasBurn,
  useEVMAbtcBurnRedeem,
  useGetRedeemFee,
} from "@/app/hooks";
import {
  useConnectMultiChain,
  useGetAtlasBTCBalanceMultiChain,
} from "@/app/hooks/useConnectMultiChain";
import { useAddFeedback } from "@/app/stores/feedback";
import { ChainConfig } from "@/app/types/chainConfig";
import { Redemptions, RedemptionStatus } from "@/app/types/redemptions";
import { useGetChainConfig } from "@/hooks";
import { useGetGlobalParams } from "@/hooks/stats";
import { useBool } from "@/hooks/useBool";
import { btcToSatoshi } from "@/utils/btcConversions";
import { getRedemptionHistoriesLocalStorageKey } from "@/utils/local_storage/getRedemptionHistoriesLocalStorageKey";
import { useNearAbtcBurnRedeem } from "@/utils/near";
import { validateBTCAddress } from "@/utils/validateAddress";

import { Button } from "../Button";
import { InputField } from "../InputField";
import { ConnectEvmWalletModal } from "../Modals/ConnectEvmWalletModal";
import { SelectField } from "../SelectField";

import { RedeemPreview } from "./RedeemPreview";

const redeemFormSchema = z.object({
  amount: z.coerce.number().positive().nonnegative(),
  chainID: z
    .string({
      required_error: "Please select a chain",
    })
    .min(1, {
      message: "Please select a chain",
    }),
  address: z
    .string({
      required_error: "Please enter a receiving address",
    })
    .min(1, {
      message: "Please enter a receiving address",
    })
    .refine(
      (value) => {
        const isValid = validateBTCAddress(value);
        console.log("isValid", isValid);
        return isValid;
      },
      {
        message: "Invalid BTC address",
      },
    ),
});

type SchemaType = z.infer<typeof redeemFormSchema>;

export interface RedeemProps {
  btcAddress: string;
}

export function Redeem({ btcAddress }: RedeemProps) {
  const { ATLAS_BTC_TOKEN, btcPublicKeyNoCoord } = useAppContext();
  const { addFeedback } = useAddFeedback();
  const evmWalletModal = useBool();
  const previewToggle = useBool(false);
  const [previewData, setReviewData] = useState<
    | (SchemaType & {
        amountSat: number;
      })
    | undefined
  >(undefined);

  const redemptionHistoriesLocalStorageKey =
    getRedemptionHistoriesLocalStorageKey(btcPublicKeyNoCoord || "");

  const [redemptionHistoriesLocalStorage, setRedemptionHistoriesLocalStorage] =
    useLocalStorage<Redemptions[]>(redemptionHistoriesLocalStorageKey, []);

  const params = useGetGlobalParams();
  const { data: chainConfigs = {} } = useGetChainConfig();

  const filteredChainConfigs = useMemo(() => {
    return Object.values(chainConfigs || {}).filter(
      (chainConfig) =>
        chainConfig.chainID !== "SIGNET" &&
        !chainConfig.chainID.endsWith("TESTNET4"),
    );
  }, [chainConfigs]);

  const {
    handleSubmit,
    trigger,
    control,
    reset,
    watch,
    setValue,
    register,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SchemaType>({
    defaultValues: {
      address: btcAddress,
    },
    resolver: zodResolver(redeemFormSchema),
    mode: "onBlur",
  });

  const chainID = watch("chainID");
  const selectedChain = useMemo(() => {
    return chainConfigs[chainID] as ChainConfig | undefined;
  }, [chainConfigs, chainID]);

  const { disconnectAsync, address: fromAddress } = useConnectMultiChain({
    onRequireEvmWallet: () => {
      evmWalletModal.setTrue();
    },
    selectedChain,
  });

  const { result: aBTCBalance, refetch: refetchABTCBalance } =
    useGetAtlasBTCBalanceMultiChain({
      selectedChain,
    });

  const { data: gasEstimate, isLoading: gasEstimateLoading } =
    useEstGasAtlasBurn({
      chainConfig: selectedChain,
      amountSat: previewData?.amountSat,
      userAddress: fromAddress || "",
    });

  const { data: redeemFee } = useGetRedeemFee({
    chainConfig: selectedChain,
    amountSat: previewData?.amountSat,
    userAddress: previewData?.address || "",
  });

  const redemptionFee = gasEstimate?.gasLimit;

  const addressLabel =
    selectedChain?.networkType === "EVM" ? "EVM address" : "Near address";

  const maxAmount = aBTCBalance.formatted || 0;

  const { mutateAsync: nearBurnRedeem, isPending: nearBurnRedeemPending } =
    useNearAbtcBurnRedeem({
      contract:
        selectedChain?.networkType === "NEAR"
          ? selectedChain.aBTCAddress
          : undefined,
    });

  const { mutateAsync: burnRedeem, isPending: burnRedeemPending } =
    useEVMAbtcBurnRedeem();

  const addDummyRedemptionRecord = (txHash: string) => {
    if (!previewData || !selectedChain || !fromAddress) return;

    const newRecord: Redemptions = {
      txnHash: `${selectedChain.chainID},${txHash}`,
      abtcRedemptionAddress: fromAddress,
      abtcRedemptionChainId: selectedChain.chainID,
      btcReceivingAddress: previewData.address,
      abtcAmount: previewData.amountSat,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      status: RedemptionStatus.ABTC_BURNT,
      remarks: "",
      btcTxnHash: "",
      protocolFee: redeemFee?.atlasProtocolFee || 0,
      yieldProviderGasFee: 0,
      btcRedemptionFee: 0,
    };

    setRedemptionHistoriesLocalStorage([
      newRecord,
      ...redemptionHistoriesLocalStorage,
    ]);
  };

  const onSubmit = async (data: SchemaType) => {
    if (!params.data) return;

    if (maxAmount === 0) {
      setError("amount", {
        type: "manual",
        message: `You have insufficient ${ATLAS_BTC_TOKEN} balance`,
      });
      return;
    }

    if (data.amount > maxAmount) {
      setError("amount", {
        type: "manual",
        message: `Please enter no more than ${maxAmount} ${ATLAS_BTC_TOKEN}`,
      });
      return;
    }

    setReviewData({
      ...data,
      amountSat: btcToSatoshi(data.amount),
    });
    previewToggle.setTrue();
  };

  const onConfirm = async () => {
    try {
      if (!fromAddress) {
        throw new Error("Wallet not connected");
      }

      if (!previewData) {
        throw new Error("Preview data not available");
      }

      if (!selectedChain) {
        throw new Error("Chain not selected");
      }

      let evmTxHash: string | undefined;

      if (selectedChain?.networkType === "EVM") {
        if (!gasEstimate) {
          throw new Error("Gas details not available");
        }

        const r = await burnRedeem({
          amount: previewData.amountSat,
          btcAddress: previewData.address,
          from: fromAddress,
          estimatedGas: gasEstimate.gasEstimate,
          gasPrice: gasEstimate.gasPrice,
          contractAddress: selectedChain.aBTCAddress,
        });

        evmTxHash = r.transactionHash;
        addDummyRedemptionRecord(evmTxHash);
        refetchABTCBalance();
      }

      if (selectedChain?.networkType === "NEAR") {
        const result = await nearBurnRedeem({
          amount: previewData.amountSat.toString(),
          btcAddress: previewData.address,
        });

        addDummyRedemptionRecord(result ? result.transaction_hash : "");
        refetchABTCBalance();
      }

      addFeedback({
        type: "success",
        content: (
          <div>
            Your transaction is pending. Please allow a few moments for your
            transaction to show up in the history section. You may close this
            window anytime
            <br />
            {evmTxHash && selectedChain && (
              <a
                href={`${selectedChain?.explorerURL}tx/${evmTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                View on Block Explorer.
              </a>
            )}
          </div>
        ),
        title: "Success",
      });

      setValue("amount", 0);
      previewToggle.toggle();
      setReviewData(undefined);
    } catch (error: Error | any) {
      console.error(error);
      addFeedback({
        type: "error",
        content: error.message || error?.error?.message || "An error occurred",
        title: "Error",
        onRetry: onConfirm,
      });
    }
  };

  const disabled =
    isSubmitting ||
    params.isLoading ||
    nearBurnRedeemPending ||
    burnRedeemPending;

  const disabledMax = disabled || maxAmount === 0;

  function handleMaxAmount() {
    setValue("amount", maxAmount);
    trigger("amount");
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div>
          <Controller
            name="chainID"
            control={control}
            render={({ field }) => {
              return (
                <SelectField
                  label={`Select Chain Holding ${ATLAS_BTC_TOKEN}`}
                  selectProps={{
                    renderTrigger: <SelectValue placeholder="Select" />,
                    disabled,
                    value: field.value?.toString(),
                    onValueChange: (value) => {
                      field.onChange(value);
                      trigger("chainID");
                      trigger("address");
                    },
                  }}
                  values={filteredChainConfigs.map((chainConfig) => ({
                    label: chainConfig.networkName,
                    value: chainConfig.chainID,
                  }))}
                  error={errors.chainID?.message}
                />
              );
            }}
          />
          {fromAddress && (
            <div className="mt-2 flex items-center gap-4">
              <p className="text-[13px] text-caption">
                {addressLabel}: {fromAddress}
              </p>
              <button
                className="font-semibold text-primary"
                onClick={() => {
                  setValue("chainID", "");
                  disconnectAsync();
                }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
        <InputField
          label="Amount"
          captionStart={
            <div className="flex items-center gap-1">
              {`(${aBTCBalance.formatted} ${ATLAS_BTC_TOKEN})`}
              <button
                className="text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={disabledMax}
                type="button"
                onClick={handleMaxAmount}
              >
                Max
              </button>
            </div>
          }
          inputProps={{
            placeholder: "0.0002",
            type: "string",
            ...register("amount"),
            onChange: () => {
              clearErrors("amount");
            },
            disabled,
          }}
          error={errors.amount?.message}
        />
        <InputField
          label="BTC Receiving Address"
          inputProps={{
            placeholder: "Address",
            ...register("address"),
            disabled,
          }}
          error={errors.address?.message}
        />
        <Button type="submit" disabled={disabled}>
          Review
        </Button>
      </form>

      <ConnectEvmWalletModal
        isOpen={evmWalletModal.value}
        onClose={evmWalletModal.setFalse}
        selectedChain={selectedChain?.networkName || null}
        selectedChainID={selectedChain?.chainID || null}
      />

      <RedeemPreview
        isPending={disabled || gasEstimateLoading}
        open={previewToggle.value}
        onClose={() => {
          previewToggle.toggle();
          setReviewData(undefined);
        }}
        amount={previewData?.amount}
        receivingAddress={previewData?.address}
        redeemChain={selectedChain?.networkName}
        transactionFee={redemptionFee}
        feeRate={gasEstimate?.gasPrice}
        atlasProtocolFee={redeemFee?.atlasProtocolFee}
        btcRedemptionFee={redeemFee?.estimatedRedemptionFee}
        onConfirm={onConfirm}
        networkType={selectedChain?.networkType}
      />
    </>
  );
}
