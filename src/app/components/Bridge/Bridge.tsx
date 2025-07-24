import { zodResolver } from "@hookform/resolvers/zod";
import { SelectValue } from "@radix-ui/react-select";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useLocalStorage } from "usehooks-ts";
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
import { BridgeHistory, BridgeStatus } from "@/app/types/bridge";
import { ChainConfig } from "@/app/types/chainConfig";
import { useGetChainConfig } from "@/hooks";
import { useGetGlobalParams } from "@/hooks/stats";
import { useBool } from "@/hooks/useBool";
import { btcToSatoshi } from "@/utils/btcConversions";
import { useEstimateAbtcMintGas } from "@/utils/getEstimateAbtcMintGas";
import { getTxBridgingFees } from "@/utils/getTxBridgingFees";
import { useNearAbtcBridge } from "@/utils/near";
import { validateBlockchainAddress } from "@/utils/validateAddress";

import { Button } from "../Button";
import { InputField } from "../InputField";
import { ConnectEvmWalletModal } from "../Modals/ConnectEvmWalletModal";
import { SelectField } from "../SelectField";

import { BridgePreview } from "./BridgePreview";

const MIN_AMOUNT = 0.0001;

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
  const selectedAddress = useBridgeStore((state) => state.selectedAddress);
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

  const bridgeHistoriesLocalStorageKey = `atlas-protocol-bridge-${selectedAddress || ""}`;
  const [bridgeHistoriesLocalStorage, setBridgeHistoriesLocalStorage] =
    useLocalStorage<BridgeHistory[]>(bridgeHistoriesLocalStorageKey, []);

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
      redeemFormSchema
        .refine(
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
        )
        .refine(
          (data) => {
            if (!params.data) return false;

            if (MIN_AMOUNT > data.amount) {
              return false;
            }

            return true;
          },
          {
            message: `Please enter a minimum amount of ${MIN_AMOUNT} ${ATLAS_BTC_TOKEN}`,
            path: ["amount"],
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
      (chainConfig) =>
        chainConfig.chainID !== "SIGNET" &&
        !chainConfig.chainID.endsWith("TESTNET4"),
    );
  }, [chainConfigs]);

  // Set first chain option when component mounts
  useEffect(() => {
    if (filteredChainConfigs.length > 0 && !fromChainID) {
      setValue("fromChainID", filteredChainConfigs[0].chainID);
      trigger("fromChainID");
    }
  }, [filteredChainConfigs, fromChainID, setValue, trigger]);

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

  const { estimateGas } = useEstimateAbtcMintGas();

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

    // Set initial data and open preview immediately
    setReviewData({
      ...data,
      amountSat: btcToSatoshi(data.amount),
    });
    previewToggle.setTrue();

    // Load bridging fees first
    try {
      const toChainConfig = chainConfigs[data?.toChainID || ""];
      const amountSat = btcToSatoshi(data.amount);
      const fees = await getTxBridgingFees(amountSat);

      if (!fees) throw new Error("Failed to get bridging fees");

      const { estimatedBridgingFee, atlasProtocolFee } = fees;

      // Update bridging fees
      setReviewData((prev) => ({
        ...prev!,
        bridgingFeeSat: estimatedBridgingFee,
        atlasProtocolFee,
      }));

      // Load minting fee using the hook
      const mintingFee = await estimateGas(
        toChainConfig?.chainRpcUrl || "",
        toChainConfig?.aBTCAddress || "",
        watch("address"),
        amountSat,
        "cd36e5e6072e3ea0ac92ad20f99ef8c736f78b3c287b43f0a8c3e8607fe6a337",
        params?.data?.evmAtlasAddress || "",
        toChainConfig?.networkType || "",
        toChainConfig?.nativeCurrency?.symbol || "",
      );

      // Update minting fee
      setReviewData((prev) => ({
        ...prev!,
        mintingFeeSat: mintingFee.mintingFeeSat,
      }));
    } catch (error) {
      console.error("Failed to fetch bridging fees:", error);
      addFeedback({
        type: "error",
        content: "Failed to calculate fees. Please try again.",
        title: "Error",
      });
    }
  };

  // Update transaction fee when gas data changes
  useEffect(() => {
    if (gas?.gasLimit && previewToggle.value) {
      setReviewData((prev) => ({
        ...prev!,
        transactionFee: gas.gasLimit,
      }));
    }
  }, [gas?.gasLimit, previewToggle.value]);

  const queryClient = useQueryClient();

  const onConfirm = async () => {
    try {
      if (!previewData) {
        throw new Error("Preview data is missing");
      }

      if (!selectedChain || !toSelectedChain) {
        throw new Error("Chain is missing");
      }

      let txnHash: string | undefined;

      if (selectedChain?.networkType === "EVM") {
        txnHash = await evmBurnRedeem({
          amount: previewData.amountSat.toString(),
          destChainAddress: previewData.address,
          destChainId: toSelectedChain?.chainID || "",
          mintingFeeSat: previewData.mintingFeeSat,
          bridgingFeeSat: previewData.bridgingFeeSat,
        });
      }

      if (selectedChain?.networkType === "NEAR") {
        const result = await nearBurnRedeem({
          amount: previewData.amountSat.toString(),
          destinationAddress: previewData.address,
          destinationChain: toSelectedChain?.chainID || "",
          mintingFeeSat: previewData.mintingFeeSat?.toString(),
          bridgingFeeSat: previewData.bridgingFeeSat?.toString(),
        });
        txnHash = result?.transaction_hash;
      }

      // Add the record to local storage
      const newBridgeHistory: BridgeHistory = {
        txn_hash: selectedChain.chainID + "," + txnHash,
        origin_chain_id: selectedChain.chainID,
        origin_chain_address: fromAddress || "",
        dest_chain_id: toSelectedChain.chainID,
        dest_chain_address: previewData.address,
        dest_txn_hash: "",
        abtc_amount: previewData.amountSat,
        timestamp: Math.floor(Date.now() / 1000),
        status: BridgeStatus.ABTC_BURNT,
        remarks: "",
        date_created: Math.floor(Date.now() / 1000),
        verified_count: 0,
        minting_fee_sat: previewData.mintingFeeSat || 0,
        protocol_fee: previewData.atlasProtocolFee || 0,
        bridging_gas_fee_sat: previewData.bridgingFeeSat || 0,
      };

      setBridgeHistoriesLocalStorage([
        newBridgeHistory,
        ...bridgeHistoriesLocalStorage,
      ]);

      addFeedback({
        type: "success",
        content: (
          <div>
            Your transaction is pending. Please allow a few moments for your
            transaction to show up in the history section. You may close this
            window anytime.
            <br />
            {txnHash && selectedChain && (
              <a
                href={`${selectedChain?.explorerURL}tx/${txnHash}`}
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
      refetchABTCBalance();
      queryClient.invalidateQueries({ queryKey: ["stats"] });
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
          captionEnd={`min: ${MIN_AMOUNT} ${ATLAS_BTC_TOKEN}`}
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
        isPending={disabled || gasEstimateLoading}
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
