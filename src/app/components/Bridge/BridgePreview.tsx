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
  fromSymbol?: string;
  toSymbol?: string;
  
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
  fromSymbol,
  toSymbol,
}: RedeemPreviewProps) {
  const { BTC_TOKEN, ATLAS_BTC_TOKEN } = useAppContext();
  const { data: stats } = useGetStats();
  const btcPriceUsd = stats?.btcPriceUsd || 0;
  const ethPriceUsd = stats?.ethPriceUsd || 0;
  const nearPriceUsd = stats?.nearPriceUsd || 0;
  const polPriceUsd = stats?.polPriceUsd || 0;
  

  console.log("mintingFeeSat:", mintingFeeSat);

  const transactionFeeUsd = transactionFee && toSymbol
    ? (Number(transactionFee) * (
      fromSymbol === "ETH" ? ethPriceUsd :
      fromSymbol === "NEAR" ? nearPriceUsd :
      fromSymbol === "POL" ? polPriceUsd : ethPriceUsd
    )).toFixed(8)
    : '--';

  // Show loading state if either fee is not available
  const isBridgingFeesLoading = bridgingFeeSat === undefined || mintingFeeSat === undefined;
  const totalBridgingFee = !isBridgingFeesLoading ? Number(bridgingFeeSat || 0) + Number(mintingFeeSat || 0) : 0;
  const totalBridgingFeeUsd = !isBridgingFeesLoading && btcPriceUsd
    ? ((totalBridgingFee / 100000000) * btcPriceUsd).toFixed(2)
    : '--';

  const atlasProtocolFeeUsd = atlasProtocolFee && btcPriceUsd
    ? ((atlasProtocolFee / 100000000) * btcPriceUsd).toFixed(2)
    : '--';

  const amountUsd = amount && btcPriceUsd
    ? (amount * btcPriceUsd).toFixed(2)
    : '--';

  const actualReceived = amount && !isBridgingFeesLoading && (atlasProtocolFee || atlasProtocolFee === 0)
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
            <p className="text-base font-semibold">{fromChain || "--"}</p>
          </div>
          <div>
            <p className="text-caption text-sm font-semibold">To</p>
            <p className="text-base font-semibold">{toChain || "--"}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">Bridging Amount</p>
          <p className="text-base font-semibold break-all">
            {amount || "--"} {ATLAS_BTC_TOKEN} <span className="text-sm text-neutral-7">(≈{amountUsd} USD)</span>
          </p>
        </div>
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">
            {ATLAS_BTC_TOKEN} Receiving Address
          </p>
          <p className="text-base font-semibold break-all">{toAddress || "--"}</p>
        </div>
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">Amount to Receive</p>
          <p className="text-base font-semibold break-all">
            {actualReceived !== '--' ? (
              <>
                {actualReceived} {ATLAS_BTC_TOKEN} <span className="text-sm text-neutral-7">(≈{actualReceivedUsd} USD)</span>
              </>
            ) : (
              <span className="text-neutral-7">Loading...</span>
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-4">
        <div className="rounded-lg border border-neutral-5 dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
          <p className="text-caption text-sm font-semibold">
            {networkType} Transaction Fee
          </p>
          <p className="text-base font-semibold break-all">
            {transactionFee ? (
              <>
                {transactionFee.toFixed(8)} <br />
                {fromSymbol}
                <span className="text-sm text-neutral-7">
                  <br />
                  (≈{transactionFeeUsd} USD)
                </span>
              </>
            ) : (
              <span className="text-neutral-7">Loading...</span>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-5 dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
          <p className="text-caption text-sm font-semibold">
            {BTC_TOKEN} Bridging Fee
          </p>
          <p className="text-base font-semibold break-all">
            {!isBridgingFeesLoading ? (
              <>
                {maxDecimals(satoshiToBtc(totalBridgingFee), 8)} <br />
                {BTC_TOKEN} <br />
                <span className="text-sm text-neutral-7">
                  (≈{totalBridgingFeeUsd} USD)
                </span>
              </>
            ) : (
              <span className="text-neutral-7">Loading...</span>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-5 dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
          <p className="text-caption text-sm font-semibold">
            Protocol Fee
          </p>
          <p className="text-base font-semibold break-all">
            {atlasProtocolFee ? (
              <>
                {maxDecimals(satoshiToBtc(atlasProtocolFee), 8)} <br />
                {BTC_TOKEN} <br />
                <span className="text-sm text-neutral-7">
                  (≈{atlasProtocolFeeUsd} USD)
                </span>
              </>
            ) : (
              <span className="text-neutral-7">Loading...</span>
            )}
          </p>
        </div>
      </div>
      <Button 
        className="mt-4 w-full" 
        onClick={onConfirm} 
        disabled={isPending || isBridgingFeesLoading || !transactionFee}
      >
        Process
      </Button>
    </Dialog>
  );
}
