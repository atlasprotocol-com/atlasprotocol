import { useAppContext } from "@/app/context/app";

import { Button } from "../Button";
import { Dialog } from "../Dialog";

export interface StakePreviewProps {
  open: boolean;
  onClose: () => void;
  feeRate?: number;
  stakingFee?: number;
  receivingAddress?: string;
  receivingChain?: string;
  stakingAmount?: number;
  protocolFee?: number;
  onConfirm?: () => void;
  isPending?: boolean;
}

export function StakePreview({
  open,
  onClose,
  feeRate,
  stakingFee,
  protocolFee,
  receivingAddress,
  receivingChain,
  stakingAmount,
  onConfirm,
  isPending, 
}: StakePreviewProps) {
  const { BTC_TOKEN, ATLAS_BTC_TOKEN } = useAppContext();
  return (
    <Dialog
      open={open}
      onOpenChange={!isPending ? onClose : undefined}
      headerTitle="Preview"
    >
      <div className="rounded-lg border border-neutral-5 dark:border-neutral-8 dark:bg-neutral-10 p-3">
        <div className="flex gap-2">
          <div className="w-[180px]">
            <p className="text-caption text-sm font-semibold">Stake Amount</p>
            <p className=" text-base font-semibold">
              {stakingAmount || "--"} {BTC_TOKEN}
            </p>
          </div>
          <div>
            <p className="text-caption text-sm font-semibold">
              {ATLAS_BTC_TOKEN} Receiving Chain
            </p>
            <p className="text-base font-semibold">{receivingChain || "--"}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">
            Receiving Address
          </p>
          <p className=" text-base font-semibold break-all ">
            {receivingAddress}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-4">
        <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
          <p className="text-caption text-sm font-semibold">Fee rate</p>
          <p className=" text-base font-semibold break-all ">
            {feeRate || "--"} sat/vB
          </p>
        </div>
        <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
          <p className="text-caption text-sm font-semibold">Transaction Fee</p>
          <p className=" text-base font-semibold break-all ">
            {stakingFee || "--"} {BTC_TOKEN}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
          <p className="text-caption text-sm font-semibold">Protocol Fee</p>
          <p className=" text-base font-semibold break-all ">
            {protocolFee ? protocolFee / 100000000 : "--"} {BTC_TOKEN}
          </p>
        </div>
      </div>
      <Button className="mt-4 w-full" onClick={onConfirm} disabled={isPending}>
        Stake
      </Button>
    </Dialog>
  );
}
