import web3 from "web3";

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
  transactionFeeEth?: number;
  receivingAddress?: string;
  redeemChain?: string;
  amount?: number;
  onConfirm?: () => void;
  isPending?: boolean;
  btcRedemptionFee?: number;
  atlasProtocolFee?: number;
  hideFee?: boolean;
}

export function RedeemPreview({
  open,
  onClose,
  feeRate,
  transactionFeeEth,
  receivingAddress,
  redeemChain,
  amount,
  atlasProtocolFee,
  btcRedemptionFee,
  onConfirm,
  isPending,
  hideFee,
}: RedeemPreviewProps) {
  const { BTC_TOKEN, ATLAS_BTC_TOKEN } = useAppContext();
  const { data: stats } = useGetStats();
  const btcPriceUsd = stats?.btcPriceUsd || 0;
  const ethPriceUsd = stats?.ethPriceUsd || 0;

  const redemptionFeeEth = web3.utils.fromWei(
    feeRate?.toString() || 0,
    "ether",
  );

  const transactionFeeUsd = transactionFeeEth && ethPriceUsd
    ? (Number(transactionFeeEth) * ethPriceUsd).toFixed(4)
    : '--';

  const redemptionFeeUsd = redemptionFeeEth && ethPriceUsd
    ? (Number(redemptionFeeEth) * ethPriceUsd).toFixed(4)
    : '--';

  const btcRedemptionFeeUsd = btcRedemptionFee && btcPriceUsd
    ? ((btcRedemptionFee / 100000000) * btcPriceUsd).toFixed(2)
    : '--';

  const atlasProtocolFeeUsd = atlasProtocolFee && btcPriceUsd
    ? ((atlasProtocolFee / 100000000) * btcPriceUsd).toFixed(2)
    : '--';

  const amountUsd = amount && btcPriceUsd
    ? (amount * btcPriceUsd).toFixed(2)
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
            <p className=" text-base font-semibold">
              {amount || "--"} {ATLAS_BTC_TOKEN} <span className="text-sm text-neutral-7">(≈{amountUsd} USD)</span>
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
          <p className=" text-base font-semibold break-all ">
            {receivingAddress}
          </p>
        </div>
      </div>
      {hideFee ? null : (
        <div className="mt-4 flex gap-4">
          <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
            <p className="text-caption text-sm font-semibold">
              EVM Transaction Fee
            </p>
            <p className=" text-base font-semibold break-all ">
              {transactionFeeEth || "--"} <br /> 
              ETH 
              <span className="text-sm text-neutral-7"><br />
              (≈{transactionFeeUsd} USD)</span>
            </p>
          </div>
          <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
            <p className="text-caption text-sm font-semibold">
              {BTC_TOKEN} Unstaking Fee
            </p>
            <p className=" text-base font-semibold break-all ">
              {maxDecimals(
                satoshiToBtc(btcRedemptionFee ? btcRedemptionFee : 0),
                8,
              ) || "--"}{" "}<br />
              {BTC_TOKEN} <br />
              <span className="text-sm text-neutral-7">
              (≈{btcRedemptionFeeUsd} USD)</span>
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
      )}
      <Button className="mt-4 w-full" onClick={onConfirm} disabled={isPending || !btcRedemptionFee}>
        Redeem
      </Button>
    </Dialog>
  );
}
