import { zodResolver } from "@hookform/resolvers/zod";
import { SelectValue } from "@radix-ui/react-select";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useAppContext } from "@/app/context/app";
import { useABtcBridge } from "@/app/hooks";
import { useEstGasAtlasBurn } from "@/app/hooks/evm/estGas";
import {
  useConnectMultiChain,
  useGetAtlasBTCBalanceMultiChain,
} from "@/app/hooks/useConnectMultiChain";
import { useBridgeStore } from "@/app/stores/bridge";
import { useAddFeedback } from "@/app/stores/feedback";
import { ChainConfig } from "@/app/types/chainConfig";
import { useGetChainConfig } from "@/hooks";
import { useGetGlobalParams } from "@/hooks/stats";
import { useBool } from "@/hooks/useBool";
import { btcToSatoshi } from "@/utils/btcConversions";
import { useNearAbtcBridge } from "@/utils/near";
import { validateBlockchainAddress } from "@/utils/validateAddress";
import { getTxBridgingFees } from "@/utils/getTxBridgingFees";
import { getEstimateAbtcMintGas } from '@/utils/getEstimateAbtcMintGas';

import { Button } from "../Button";
import { InputField } from "../InputField";
import { ConnectEvmWalletModal } from "../Modals/ConnectEvmWalletModal";
import { SelectField } from "../SelectField";

import { BridgePreview } from "./BridgePreview";

const redeemFormSchema = z.object({
  amount: z.coerce.number().positive().nonnegative(),
  fromChainID: z
    .string({
      required_error: "Please select a chain",
    })
    .min(1, {
      message: "Please select a chain",
    }),
  toChainID: z
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

type SchemaType = z.infer<typeof redeemFormSchema>;

export interface RedeemProps {
  btcAddress: string;
}

export function Bridge() {
  const { ATLAS_BTC_TOKEN } = useAppContext();
  const setBridgeStore = useBridgeStore((state) => state.set);
  const { addFeedback } = useAddFeedback();
  const evmWalletModal = useBool();
  const previewToggle = useBool(false);
  const [previewData, setReviewData] = useState<
    | (SchemaType & {
        amountSat: number;
        transactionFee?: number;
        bridgingFeeSat?: number;
        atlasProtocolFee?: number;
        mintingFeeSat?: number;
      })
    | undefined
  >(undefined);

  const params = useGetGlobalParams();
  const { data: chainConfigs = {} } = useGetChainConfig();

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
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<SchemaType>({
    resolver: zodResolver(
      redeemFormSchema.refine(
        (data) => {
          const chain = chainConfigs[data.toChainID];
          if (
            !chain ||
            (chain.networkType !== "EVM" && chain.networkType !== "NEAR")
          ) {
            return true;
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
      ),
    ),
    mode: "onBlur",
  });

  const fromChainID = watch("fromChainID");
  const toChainID = watch("toChainID");
  const selectedChain = useMemo(() => {
    return chainConfigs[fromChainID] as ChainConfig | undefined;
  }, [chainConfigs, fromChainID]);
  const toSelectedChain = useMemo(() => {
    return chainConfigs[toChainID] as ChainConfig | undefined;
  }, [chainConfigs, toChainID]);

  const selectedEVMChain = useMemo(() => {
    if (selectedChain?.networkType === "EVM") {
      return selectedChain;
    }
  }, [selectedChain]);

  const selectedNearChain = useMemo(() => {
    if (selectedChain?.networkType === "NEAR") {
      return selectedChain;
    }
  }, [selectedChain]);

  const filteredChainConfigs = useMemo(() => {
    return Object.values(chainConfigs || {}).filter(
      (chainConfig) => chainConfig.chainID !== "SIGNET" && !chainConfig.chainID.endsWith("TESTNET4"),
    );
  }, [chainConfigs]);

  const filteredChainToConfigs = useMemo(() => {
    return Object.values(chainConfigs || {}).filter(
      (chainConfig) =>
        chainConfig.chainID !== "SIGNET" &&
        chainConfig.chainID !== selectedChain?.chainID &&
        !chainConfig.chainID.endsWith("TESTNET4"),
    );
  }, [chainConfigs, selectedChain?.chainID]);

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

  const addressLabel =
    selectedChain?.networkType === "EVM" ? "EVM address" : "Near address";

  const maxAmount = aBTCBalance.formatted || 0;

  const { mutateAsync: nearBurnRedeem, isPending: nearBurnRedeemPending } =
    useNearAbtcBridge({
      contract: selectedNearChain?.aBTCAddress,
    });

  const { mutateAsync: evmBurnRedeem, isPending: burnRedeemPending } =
    useABtcBridge({
      tokenAddress: selectedEVMChain?.aBTCAddress,
    });

  const { data: gas, isLoading: gasEstimateLoading } = useEstGasAtlasBurn({
    chainConfig: selectedChain,
    amountSat: btcToSatoshi(watch("amount")),
    userAddress: fromAddress || "",
  });

  

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

    try {
      const fees = await getTxBridgingFees(btcToSatoshi(data.amount));

      console.log("fees", fees);
      if (!fees) throw new Error("Failed to get bridging fees");

      const { estimatedBridgingFee, atlasProtocolFee } = fees;

      console.log("gas", gas);
      const transactionFee = gas?.gasLimit || 0;

      const toChainConfig = chainConfigs[data?.toChainID || ''];

      const mintingFee = await getEstimateAbtcMintGas(
        toChainConfig?.chainRpcUrl || '',
        toChainConfig?.aBTCAddress || '',
        watch("address"),
        btcToSatoshi(watch("amount")),
        "cd36e5e6072e3ea0ac92ad20f99ef8c736f78b3c287b43f0a8c3e8607fe6a337",
        params?.data?.evmAtlasAddress || "",
        toChainConfig?.networkType || "",
        toChainConfig?.nativeCurrency?.symbol || ""
      );

      setReviewData({
        ...data,
        amountSat: btcToSatoshi(data.amount),
        transactionFee,
        bridgingFeeSat: estimatedBridgingFee,
        atlasProtocolFee,
        mintingFeeSat: mintingFee.mintingFeeSat,
      });

      previewToggle.setTrue();
    } catch (error) {
      console.error("Failed to fetch bridging fees:", error);
      addFeedback({
        type: "error",
        content: "Failed to calculate fees. Please try again.",
        title: "Error",
      });
    }
  };

  const onConfirm = async () => {
    try {
      if (!previewData) {
        throw new Error("Preview data is missing");
      }

      if (!selectedChain || !toSelectedChain) {
        throw new Error("Chain is missing");
      }

      let evmTxHash: string | undefined;

      if (selectedChain?.networkType === "EVM") {
        evmTxHash = await evmBurnRedeem({
          amount: previewData.amountSat.toString(),
          destChainAddress: previewData.address,
          destChainId: toSelectedChain?.chainID || "",
          mintingFeeSat: previewData.mintingFeeSat,
          bridgingFeeSat: previewData.bridgingFeeSat,
        });
      }

      if (selectedChain?.networkType === "NEAR") {
        await nearBurnRedeem({
          amount: previewData.amountSat.toString(),
          destinationAddress: previewData.address,
          destinationChain: toSelectedChain?.chainID || "",
          mintingFeeSat: previewData.mintingFeeSat?.toString(),
          bridgingFeeSat: previewData.bridgingFeeSat?.toString(),
        });
      }
      addFeedback({
        type: "success",
        content: (
          <div>
            Your transaction is pending. Please allow a few moments for your
            transaction to show up in the history section. You may close this
            window anytime.
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

      reset();
      previewToggle.toggle();
      setReviewData(undefined);
      refetchABTCBalance();
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

  useEffect(() => {
    setBridgeStore((state) => {
      state.selectedAddress = fromAddress || "";
      state.selectedChainId = fromChainID;
    });
  }, [fromAddress, fromChainID, setBridgeStore]);

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div>
          <Controller
            name="fromChainID"
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
                      trigger("fromChainID");
                      setValue("toChainID", "");
                    },
                  }}
                  values={filteredChainConfigs.map((chainConfig) => ({
                    label: chainConfig.networkName,
                    value: chainConfig.chainID,
                  }))}
                  error={errors.fromChainID?.message}
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
                  setValue("fromChainID", "");
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
        <Controller
          name="toChainID"
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
                    trigger("toChainID");
                  },
                }}
                values={filteredChainToConfigs.map((chainConfig) => ({
                  label: chainConfig.networkName,
                  value: chainConfig.chainID,
                }))}
                error={errors.toChainID?.message}
              />
            );
          }}
        />
        <InputField
          label="Receiving Address"
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

      <BridgePreview
        isPending={disabled}
        open={previewToggle.value}
        onClose={() => {
          previewToggle.toggle();
          setReviewData(undefined);
        }}
        amount={previewData?.amount}
        fromChain={selectedChain?.networkName}
        toChain={toSelectedChain?.networkName}
        toAddress={previewData?.address}
        transactionFee={previewData?.transactionFee}
        bridgingFeeSat={previewData?.bridgingFeeSat}
        atlasProtocolFee={previewData?.atlasProtocolFee}
        mintingFeeSat={previewData?.mintingFeeSat}
        onConfirm={onConfirm}
        networkType={selectedChain?.networkType}
        fromSymbol={selectedChain?.nativeCurrency?.symbol}
        toSymbol={toSelectedChain?.nativeCurrency?.symbol}
      />
    </>
  );
}
