import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useAppContext } from "@/app/context/app";
import {
  useGetAccountUTXO,
  useGetMempoolFeeRate,
  useGetStakingFee,
  useSignStaking,
} from "@/app/hooks/btc";
import { useAddFeedback } from "@/app/stores/feedback";
import { getNetworkConfig } from "@/config/network.config";
import { useGetChainConfig } from "@/hooks";
import { useGetGlobalParams } from "@/hooks/stats";
import { useBool } from "@/hooks/useBool";
import { btcToSatoshi } from "@/utils/btcConversions";
import { validateBlockchainAddress } from "@/utils/validateAddress";
import { WalletProvider } from "@/utils/wallet/wallet_provider";

import { Button } from "../Button";
import { InputField } from "../InputField";
import { SelectValue } from "../Select";
import { SelectField } from "../SelectField";

import { StakePreview } from "./StakePreview";

const stakeFormSchema = z.object({
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
    }),
});

export interface StakeProps {
  formattedBalance?: number;
  btcWallet: WalletProvider | undefined;
  btcBalanceSat: number;
}

type SchemaType = z.infer<typeof stakeFormSchema>;

export function Stake({ formattedBalance }: StakeProps) {
  const { mempoolApiUrl } = getNetworkConfig();
  const params = useGetGlobalParams();
  const { addFeedback } = useAddFeedback();
  const { BTC_TOKEN, btcRefreshBalance } = useAppContext();

  const {
    data: mempoolFeeRates,
    isLoading: mempoolFeeRatesLoading,
    refetch: refetchMempoolFeeRates,
  } = useGetMempoolFeeRate();
  const {
    data: accountUTXOs,
    isLoading: accountUTXOsLoading,
    refetch: refetchAccountUTXOs,
  } = useGetAccountUTXO();

  const previewToggle = useBool(false);
  const [previewData, setReviewData] = useState<
    | (SchemaType & {
        amountSat: number;
      })
    | undefined
  >(undefined);

  const stakingFee = useGetStakingFee({
    feeRate: mempoolFeeRates?.feeRates?.defaultFeeRate,
    inputUTXOs: accountUTXOs,
    receivingAddress: previewData?.address,
    receivingChainID: previewData?.chainID,
    stakingAmountSat: previewData?.amountSat,
    protocolFeeSat: params?.data?.feeDepositPercentage === 0
        ? 0
        : Math.floor(Math.max(
            1000,
            ((params?.data?.feeDepositPercentage || 0) * (previewData?.amountSat || 0))
          )),
    treasuryAddress: params?.data?.treasuryAddress || "",
  });

  const { data: chainConfigs = {} } = useGetChainConfig();

  const filteredChainConfigs = useMemo(() => {
    return Object.values(chainConfigs || {}).filter(
      (chainConfig) => chainConfig.chainID !== "SIGNET",
    );
  }, [chainConfigs]);

  const sign = useSignStaking();

  const max = useMemo(() => {
    return (
      (formattedBalance || 0) - (params.data?.formattedMinStakingAmount || 0)
    );
  }, [formattedBalance, params.data?.formattedMinStakingAmount]);

  const {
    handleSubmit,
    trigger,
    control,
    reset,
    register,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SchemaType>({
    resolver: zodResolver(
      stakeFormSchema
        .refine(
          (data) => {
            const chain = chainConfigs[data.chainID];
            if (
              !chain ||
              (chain.networkType !== "EVM" && chain.networkType !== "NEAR")
            ) {
              return false;
            }

            return validateBlockchainAddress({
              address: data.address,
              networkType: chain.networkType,
            });
          },
          {
            message: "Please enter a valid address",
            path: ["address"],
          },
        )
        .refine(
          (data) => {
            if (!params.data) return false;

            return (
              data.amount >= params.data.formattedMinStakingAmount &&
              data.amount <= max
            );
          },
          {
            message: `Please enter an amount between ${params.data?.formattedMinStakingAmount} and ${max} ${BTC_TOKEN}`,
            path: ["amount"],
          },
        ),
    ),
    mode: "onBlur",
  });

  const onSubmit = async (data: SchemaType) => {
    setReviewData({
      ...data,
      amountSat: btcToSatoshi(data.amount),
    });
    previewToggle.setTrue();
  };

  const handleConfirm = async () => {
    try {
      if (!previewData) {
        throw new Error("Preview data not found");
      }

      if (!accountUTXOs || accountUTXOs.length === 0) {
        throw new Error("UTXOs not loaded or there are pending transactions.");
      }

      if (!mempoolFeeRates?.feeRates?.defaultFeeRate) {
        throw new Error("Fee rate not loaded");
      }

      if (!stakingFee?.amount) {
        throw new Error("Staking fee not loaded");
      }

      const txHash = await sign.mutateAsync({
        availableUTXOs: accountUTXOs,
        feeRate: mempoolFeeRates?.feeRates?.defaultFeeRate,
        stakingAmountSat: previewData?.amountSat + stakingFee?.amount,
        stakingReceivingAddress: previewData?.address,
        stakingReceivingChainID: previewData?.chainID,
        protocolFeeSat: params?.data?.feeDepositPercentage === 0
        ? 0
        : Math.floor(Math.max(
            1000,
            ((params?.data?.feeDepositPercentage || 0) * (previewData?.amountSat || 0))
          )),
        treasuryAddress: params?.data?.treasuryAddress || "",
      });

      addFeedback({
        title: "Success",
        content: (
          <div>
            Your transaction is pending. Please allow a few moments for your
            transaction to show up in the history section. You may close this
            window anytime
            <br />
            {txHash && (
              <a
                href={`${mempoolApiUrl}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                View on Block Explorer.
              </a>
            )}
          </div>
        ),
        type: "success",
      });

      previewToggle.toggle();
      setReviewData(undefined);
      reset();
      refetchAccountUTXOs();
      refetchMempoolFeeRates();
      btcRefreshBalance();
    } catch (error: Error | any) {
      addFeedback({
        title: "Error",
        content: error?.message || "An error occurred",
        type: "error",
        onRetry: () => handleConfirm(),
      });
      refetchAccountUTXOs();
      refetchMempoolFeeRates();
    }
  };

  const previewDataDisplay = useMemo(() => {
    if (!previewData) return {};

    const chainConfig = chainConfigs[previewData.chainID];
    console.log(stakingFee);
    return {
      amount: previewData.amount,
      networkName: chainConfig?.networkName,
      address: previewData.address,
      feeRate: mempoolFeeRates?.feeRates?.defaultFeeRate,
      stakingFee: stakingFee?.formatted,
      protocolFeeSat:
        params?.data?.feeDepositPercentage === 0
          ? 0
          : Math.floor(
              Math.max(
                1000,
                (params?.data?.feeDepositPercentage || 0) *
                  (previewData?.amountSat || 0),
              ),
            ),
    };
  }, [
    chainConfigs,
    mempoolFeeRates?.feeRates?.defaultFeeRate,
    params?.data?.feeDepositPercentage,
    previewData,
    stakingFee,
  ]);

  const disabled =
    isSubmitting ||
    params.isLoading ||
    mempoolFeeRatesLoading ||
    accountUTXOsLoading;

  const disabledMax =
    !params.data ||
    !formattedBalance ||
    formattedBalance - params.data.formattedMinStakingAmount <
      params.data.formattedMinStakingAmount ||
    disabled;

  function handleMaxAmount() {
    if (params.data && formattedBalance) {
      setValue(
        "amount",
        formattedBalance - params.data.formattedMinStakingAmount,
      );
      trigger("amount");
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <InputField
          label="Amount"
          captionStart={
            <div className="flex items-center gap-1">
              {`(${formattedBalance} ${BTC_TOKEN})`}
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
          captionEnd={
            params.data
              ? `min: ${params.data.formattedMinStakingAmount} ${BTC_TOKEN}`
              : ""
          }
          inputProps={{
            placeholder:
              params.data?.formattedMinStakingAmount.toString() || "0.0002",
            type: "string",
            ...register("amount"),
            disabled,
          }}
          error={errors.amount?.message}
        />
        <Controller
          name="chainID"
          control={control}
          render={({ field }) => {
            return (
              <SelectField
                label="Select Receiving Chain"
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
        <InputField
          label="Enter Receiving Address"
          inputProps={{
            placeholder: "Address",
            ...register("address"),
            disabled,
          }}
          error={errors.address?.message}
        />
        <Button type="submit">Review</Button>
      </form>
      <StakePreview
        open={previewToggle.value}
        onClose={() => {
          previewToggle.toggle();
          setReviewData(undefined);
        }}
        feeRate={previewDataDisplay.feeRate}
        stakingAmount={previewDataDisplay.amount}
        protocolFee={previewDataDisplay.protocolFeeSat}
        stakingFee={previewDataDisplay.stakingFee}
        receivingAddress={previewDataDisplay.address}
        receivingChain={previewDataDisplay.networkName}
        onConfirm={handleConfirm}
      />
    </>
  );
}
