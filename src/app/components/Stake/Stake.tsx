import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useLocalStorage } from "usehooks-ts";
import { z } from "zod";

import { useAppContext } from "@/app/context/app";
import {
  useGetAccountUTXO,
  useGetMempoolFeeRate,
  useGetStakingFee,
  useSignStaking,
} from "@/app/hooks/btc";
import { useAddFeedback } from "@/app/stores/feedback";
import { DepositStatus, Stakes } from "@/app/types/stakes";
import { getNetworkConfig } from "@/config/network.config";
import { useGetChainConfig } from "@/hooks";
import { useGetGlobalParams, useGetStats } from "@/hooks/stats";
import { useBool } from "@/hooks/useBool";
import { btcToSatoshi } from "@/utils/btcConversions";
import { useEstimateAbtcMintGas } from "@/utils/getEstimateAbtcMintGas";
import { getStakingHistoriesLocalStorageKey } from "@/utils/local_storage/getStakingHistoriesLocalStorageKey";
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
  const {
    BTC_TOKEN,
    btcRefreshBalance,
    btcPublicKeyNoCoord,
    btcManualMinusBalance,
  } = useAppContext();
  const { data: stats } = useGetStats();
  const ethPriceBtc = stats?.ethPriceBtc || 0;

  const stakingHistoriesLocalStorageKey = getStakingHistoriesLocalStorageKey(
    btcPublicKeyNoCoord || "",
  );

  const [stakingHistoriesLocalStorage, setStakingHistoriesLocalStorage] =
    useLocalStorage<Stakes[]>(stakingHistoriesLocalStorageKey, []);

  const {
    data: mempoolFeeRates,
    isLoading: mempoolFeeRatesLoading,
    refetch: refetchMempoolFeeRates,
  } = useGetMempoolFeeRate();

  console.log("mempoolFeeRates", mempoolFeeRates);
  const {
    data: accountUTXOs,
    isLoading: accountUTXOsLoading,
    refetch: refetchAccountUTXOs,
  } = useGetAccountUTXO();

  const previewToggle = useBool(false);
  const [previewData, setReviewData] = useState<
    | (SchemaType & {
        amountSat: number;
        mintingFee: number;
      })
    | undefined
  >(undefined);

  const protocolFee =
    params?.data?.feeDepositPercentage === 0
      ? 0
      : Math.floor(
          Math.max(
            Number(process.env.NEXT_PUBLIC_DUST_LIMIT),
            (params?.data?.feeDepositPercentage || 0) *
              (previewData?.amountSat || 0),
          ),
        );

  const stakingFee = useGetStakingFee({
    feeRate: mempoolFeeRates?.feeRates?.defaultFeeRate,
    inputUTXOs: accountUTXOs,
    receivingAddress: previewData?.address,
    receivingChainID: previewData?.chainID,
    stakingAmountSat: previewData?.amountSat,
    mintingFeeSat: previewData?.mintingFee,
    protocolFeeSat: protocolFee,
    treasuryAddress: params?.data?.treasuryAddress || "",
  });

  const { data: chainConfigs = {} } = useGetChainConfig();

  const filteredChainConfigs = useMemo(() => {
    return Object.values(chainConfigs || {}).filter(
      (chainConfig) =>
        chainConfig.chainID !== "SIGNET" && chainConfig.chainID !== "TESTNET4",
    );
  }, [chainConfigs]);

  const sign = useSignStaking();

  const max = useMemo(() => {
    return (
      (formattedBalance || 0) -
      (mempoolFeeRates?.feeRates?.defaultFeeRate || 0) / 100000
    );
  }, [formattedBalance, mempoolFeeRates?.feeRates?.defaultFeeRate]);

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
          (data: {
            amount: number;
            chainID: string;
            address: string;
          }): data is { amount: number; chainID: string; address: string } => {
            if (!params.data) return false;

            if (params.data.formattedMinStakingAmount > data.amount) {
              return false;
            }

            return data.amount <= max;
          },
          {
            message:
              max < 0
                ? `You don't have enough balance`
                : `Please enter a minimum amount of ${params.data?.formattedMinStakingAmount} ${BTC_TOKEN}`,
            path: ["amount"],
          },
        ),
    ),
    mode: "onBlur",
  });

  const { estimateGas } = useEstimateAbtcMintGas();

  const onSubmit = async (data: SchemaType) => {
    const amountSat = btcToSatoshi(data.amount);

    // Set initial data and open preview immediately
    setReviewData({
      ...data,
      amountSat: btcToSatoshi(data.amount),
      mintingFee: Number(process.env.NEXT_PUBLIC_DUST_LIMIT), // Set initial minting fee
    });
    previewToggle.setTrue();

    try {
      const mintingFee = await estimateGas(
        chainConfigs[data.chainID].chainRpcUrl,
        chainConfigs[data.chainID].aBTCAddress,
        data.address,
        amountSat,
        "cd36e5e6072e3ea0ac92ad20f99ef8c736f78b3c287b43f0a8c3e8607fe6a337",
        params?.data?.evmAtlasAddress || "",
        chainConfigs[data.chainID].networkType,
        chainConfigs[data.chainID].nativeCurrency?.symbol || "",
      );
      ``;

      // Update preview data with actual minting fee
      setReviewData((prev) => ({
        ...prev!,
        mintingFee: Math.max(
          Number(process.env.NEXT_PUBLIC_DUST_LIMIT),
          mintingFee.mintingFeeSat,
        ),
      }));
    } catch (error) {
      console.error("Failed to fetch minting fee:", error);
      addFeedback({
        type: "error",
        content: "Failed to calculate minting fee. Please try again.",
        title: "Error",
      });
    }
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

      if (!stakingFee?.amount || !stakingFee?.yieldProviderGasFee) {
        throw new Error("Staking fee or yield provider gas fee not loaded");
      }

      console.log(previewData.amountSat, stakingFee?.amount);

      const txHash = await sign.mutateAsync({
        availableUTXOs: accountUTXOs,
        feeRate: mempoolFeeRates?.feeRates?.defaultFeeRate,
        stakingAmountSat: previewData?.amountSat,
        stakingReceivingAddress: previewData?.address,
        stakingReceivingChainID: previewData?.chainID,
        protocolFeeSat: protocolFee,
        mintingFeeSat: previewData?.mintingFee,
        treasuryAddress: params?.data?.treasuryAddress || "",
      });

      // Add dummy record to local storage
      const newRecord: Stakes = {
        timestamp: Math.floor(Date.now() / 1000).toString(),
        btcAmount: previewData.amountSat,
        protocolFee: protocolFee,
        mintingFee: previewData.mintingFee,
        yieldProviderGasFee: stakingFee?.yieldProviderGasFee,
        receivingChainId: previewData.chainID,
        receivingAddress: previewData.address,
        btcTxnHash: txHash,
        minted_txn_hash: "",
        status: DepositStatus.BTC_PENDING_DEPOSIT_MEMPOOL,
        remarks: "",
        btcSenderAddress: "",
      };

      console.log("newRecord", newRecord);

      setStakingHistoriesLocalStorage([
        newRecord,
        ...stakingHistoriesLocalStorage,
      ]);

      btcManualMinusBalance(previewData.amountSat);

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
      console.error(error);
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

    return {
      amount: previewData.amountSat,
      networkName: chainConfig?.networkName,
      address: previewData.address,
      feeRate: mempoolFeeRates?.feeRates?.defaultFeeRate || 0,
      stakingFee: stakingFee?.amount,
      yieldProviderGasFee: stakingFee?.yieldProviderGasFee,
      protocolFeeSat: protocolFee,
    };
  }, [
    chainConfigs,
    mempoolFeeRates?.feeRates?.defaultFeeRate,
    previewData,
    protocolFee,
    stakingFee?.amount,
    stakingFee?.yieldProviderGasFee,
  ]);

  const disabled =
    isSubmitting ||
    params.isLoading ||
    mempoolFeeRatesLoading ||
    accountUTXOsLoading;

  const disabledMax =
    !params.data ||
    !formattedBalance ||
    formattedBalance < params.data.formattedMinStakingAmount ||
    disabled;

  function handleMaxAmount() {
    if (params.data && formattedBalance) {
      setValue(
        "amount",
        Number(
          (
            formattedBalance -
            (mempoolFeeRates?.feeRates?.defaultFeeRate || 0) / 100000
          ).toFixed(8),
        ),
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
              {`(${Math.max(0, (formattedBalance || 0) - (mempoolFeeRates?.feeRates?.defaultFeeRate || 0) / 100000).toFixed(8)} ${BTC_TOKEN})`}
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
        yieldProviderGasFee={previewDataDisplay.yieldProviderGasFee}
        receivingAddress={previewDataDisplay.address}
        receivingChain={previewDataDisplay.networkName}
        mintingFee={previewData?.mintingFee}
        minStakingAmount={params.data?.formattedMinStakingAmount}
        onConfirm={handleConfirm}
        isUTXOsReady={!(!accountUTXOs || accountUTXOs.length === 0)}
      />
    </>
  );
}
