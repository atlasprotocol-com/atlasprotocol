import web3 from "web3";

import { useAppContext } from "@/app/context/app";
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
  atlasRedemptionFee?: number;
  hideFee?: boolean;
}

export function RedeemPreview({
  open,
  onClose,
  feeRate,
  transactionFee,
  receivingAddress,
  redeemChain,
  amount,
  atlasRedemptionFee,
  btcRedemptionFee,
  onConfirm,
  isPending,
  hideFee,
}: RedeemPreviewProps) {
  const { BTC_TOKEN, ATLAS_BTC_TOKEN } = useAppContext();

  const redemptionFeeEth = web3.utils.fromWei(
    feeRate?.toString() || 0,
    "ether",
  );

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
              {amount || "--"} {ATLAS_BTC_TOKEN}
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
              EVM Transaction fee
            </p>
            <p className=" text-base font-semibold break-all ">
              {redemptionFeeEth || "--"} ETH
            </p>
          </div>
          <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
            <p className="text-caption text-sm font-semibold">
              {BTC_TOKEN} Transaction fee
            </p>
            <p className=" text-base font-semibold break-all ">
              {maxDecimals(
                satoshiToBtc(btcRedemptionFee ? btcRedemptionFee : 0),
                8,
              ) || "--"}{" "}
              {BTC_TOKEN}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
            <p className="text-caption text-sm font-semibold">
              Atlas Protocol fee
            </p>
            <p className=" text-base font-semibold break-all ">
              {maxDecimals(
                satoshiToBtc(atlasRedemptionFee ? atlasRedemptionFee : 0),
                8,
              ) || "--"}{" "}
            </p>
          </div>
        </div>
      )}
      <Button className="mt-4 w-full" onClick={onConfirm} disabled={isPending}>
        Redeem
      </Button>
    </Dialog>
  );
}
