import { useAppContext } from "@/app/context/app";
import { useGetStats } from "@/hooks/stats";
import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";

import { Button } from "../Button";
import { Dialog } from "../Dialog";

export interface RedeemPreviewProps {
  open: boolean;
  onClose: () => void;
  fromChain?: string;
  toChain?: string;
  amount?: number;
  toAddress?: string;
  transactionFee?: number;
  bridgingFeeSat?: number;
  atlasProtocolFee?: number;
  mintingFeeSat?: number;
  onConfirm?: () => void;
  isPending?: boolean;
  networkType?: string;
}

export function BridgePreview({
  open,
  onClose,
  amount,
  fromChain,
  toChain,
  toAddress,
  transactionFee,
  bridgingFeeSat,
  atlasProtocolFee,
  mintingFeeSat,
  onConfirm,
  isPending,
  networkType,
}: RedeemPreviewProps) {
  const { BTC_TOKEN, ATLAS_BTC_TOKEN } = useAppContext();
  const { data: stats } = useGetStats();
  const btcPriceUsd = stats?.btcPriceUsd || 0;
  const ethPriceUsd = stats?.ethPriceUsd || 0;
  const nearPriceUsd = stats?.nearPriceUsd || 0;
  
  const transactionFeeUsd = transactionFee && (networkType === "EVM" ? ethPriceUsd : nearPriceUsd)
    ? (Number(transactionFee) * (networkType === "EVM" ? ethPriceUsd : nearPriceUsd)).toFixed(4)
    : '--';

  const totalBridgingFee = bridgingFeeSat ? bridgingFeeSat + (mintingFeeSat || 0) : 0;
  const totalBridgingFeeUsd = totalBridgingFee && btcPriceUsd
    ? ((totalBridgingFee / 100000000) * btcPriceUsd).toFixed(2)
    : '--';

  const atlasProtocolFeeUsd = atlasProtocolFee && btcPriceUsd
    ? ((atlasProtocolFee / 100000000) * btcPriceUsd).toFixed(2)
    : '--';

  const amountUsd = amount && btcPriceUsd
    ? (amount * btcPriceUsd).toFixed(2)
    : '--';

  const actualReceived = amount && (totalBridgingFee || totalBridgingFee === 0) && (atlasProtocolFee || atlasProtocolFee === 0)
    ? Number((amount - (totalBridgingFee / 100000000) - (atlasProtocolFee / 100000000)).toFixed(8))
    : '--';

  const actualReceivedUsd = actualReceived !== '--' && btcPriceUsd
    ? (actualReceived * btcPriceUsd).toFixed(2)
    : '--';

  return (
    <Dialog
      open={open}
      onOpenChange={!isPending ? onClose : undefined}
      headerTitle="Preview"
    >
      <div className="rounded-lg border border-neutral-5 dark:border-neutral-8 dark:bg-neutral-10 p-3">
        <div className="flex gap-2">
          <div className="w-[180px]">
            <p className="text-caption text-sm font-semibold">From</p>
            <p className=" text-base font-semibold">{fromChain || "--"}</p>
          </div>
          <div>
            <p className="text-caption text-sm font-semibold">To</p>
            <p className="text-base font-semibold">{toChain || "--"}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">Bridging Amount</p>
          <p className=" text-base font-semibold break-all ">
            {amount || "--"} {ATLAS_BTC_TOKEN} <span className="text-sm text-neutral-7">(≈{amountUsd} USD)</span>
          </p>
        </div>
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">
            {ATLAS_BTC_TOKEN} Receiving Address
          </p>
          <p className=" text-base font-semibold break-all ">{toAddress}</p>
        </div>
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">Amount to Receive</p>
          <p className="text-base font-semibold break-all">
            {actualReceived} {ATLAS_BTC_TOKEN} <span className="text-sm text-neutral-7">(≈{actualReceivedUsd} USD)</span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-4">
        <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
          <p className="text-caption text-sm font-semibold">
              {networkType} Transaction Fee
            </p>
            <p className=" text-base font-semibold break-all ">
              {transactionFee?.toFixed(8) || "--"} <br /> 
              {networkType === "EVM" ? "ETH" : "NEAR"}
              <span className="text-sm text-neutral-7"><br />
              (≈{transactionFeeUsd} USD)</span>
            </p>
          </div>
          <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
            <p className="text-caption text-sm font-semibold">
              {BTC_TOKEN} Bridging Fee
            </p>
            <p className=" text-base font-semibold break-all ">
              {maxDecimals(
                satoshiToBtc(totalBridgingFee),
                8,
              ) || "--"}{" "}<br />
              {BTC_TOKEN} <br />
              <span className="text-sm text-neutral-7">
              (≈{totalBridgingFeeUsd} USD)</span>
            </p>
          </div>
          <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
            <p className="text-caption text-sm font-semibold">
              Protocol Fee
            </p>
            <p className=" text-base font-semibold break-all ">
              {maxDecimals(
                satoshiToBtc(atlasProtocolFee ? atlasProtocolFee : 0),
                8,
              ) || "--"}{" "} <br />
              {BTC_TOKEN} <br />
              <span className="text-sm text-neutral-7">
              (≈{atlasProtocolFeeUsd} USD)</span>
            </p>
          </div>
        </div>
      <Button className="mt-4 w-full" onClick={onConfirm} disabled={isPending}>
        Process
      </Button>
    </Dialog>
  );
}
