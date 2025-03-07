import { useAppContext } from "@/app/context/app";
import { useGetStats } from "@/hooks/stats";
import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";

import { Button } from "../Button";
import { Dialog } from "../Dialog";

export interface RedeemPreviewProps {
  open: boolean;
  onClose: () => void;
  feeRate?: number;
  transactionFee?: number;
  receivingAddress?: string;
  redeemChain?: string;
  amount?: number;
  onConfirm?: () => void;
  isPending?: boolean;
  btcRedemptionFee?: number;
  atlasProtocolFee?: number;
  networkType?: string;
}

export function RedeemPreview({
  open,
  onClose,
  feeRate,
  transactionFee,
  receivingAddress,
  redeemChain,
  amount,
  atlasProtocolFee,
  btcRedemptionFee,
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
    : "--";

  const btcRedemptionFeeUsd =
    btcRedemptionFee && btcPriceUsd
      ? ((btcRedemptionFee / 100000000) * btcPriceUsd).toFixed(2)
      : "--";

  const atlasProtocolFeeUsd =
    atlasProtocolFee && btcPriceUsd
      ? ((atlasProtocolFee / 100000000) * btcPriceUsd).toFixed(2)
      : "--";

  const amountUsd =
    amount && btcPriceUsd ? (amount * btcPriceUsd).toFixed(2) : "--";

  const totalFees = Number(btcRedemptionFee || 0) + Number(atlasProtocolFee || 0);
  const actualReceived = amount && (totalFees || totalFees === 0)
    ? Math.max(0, Number((amount - (totalFees / 100000000)).toFixed(8)))
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
            <p className="text-caption text-sm font-semibold">
              Redemption Amount
            </p>
            <p className="text-base font-semibold">
              {amount ? (
                <>
                  {amount} {ATLAS_BTC_TOKEN}{" "}
                  <span className="text-sm text-neutral-7">(≈{amountUsd} USD)</span>
                </>
              ) : (
                <span className="text-neutral-7">Loading...</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-caption text-sm font-semibold">
              Redemption Chain
            </p>
            <p className="text-base font-semibold">{redeemChain || "--"}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">
            {BTC_TOKEN} Receiving Address
          </p>
          <p className="text-base font-semibold break-all">
            {receivingAddress || "--"}
          </p>
        </div>
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">Amount to Receive (Estimated)</p>
          <p className="text-base font-semibold break-all">
            {actualReceived !== '--' ? (
              <>
                {actualReceived} {BTC_TOKEN} <span className="text-sm text-neutral-7">(≈{actualReceivedUsd} USD)</span>
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
                {networkType === "EVM" ? "ETH" : "NEAR"}
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
            {BTC_TOKEN} Unstaking Fee (Estimated)
          </p>
          <p className="text-base font-semibold break-all">
            {btcRedemptionFee ? (
              <>
                {maxDecimals(satoshiToBtc(btcRedemptionFee), 8)} <br />
                {BTC_TOKEN} <br />
                <span className="text-sm text-neutral-7">
                  (≈{btcRedemptionFeeUsd} USD)
                </span>
              </>
            ) : (
              <span className="text-neutral-7">Loading...</span>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-5 dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
          <p className="text-caption text-sm font-semibold">Protocol Fee</p>
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
        disabled={isPending || !btcRedemptionFee || !transactionFee || !atlasProtocolFee}
      >
        Redeem
      </Button>
    </Dialog>
  );
}
