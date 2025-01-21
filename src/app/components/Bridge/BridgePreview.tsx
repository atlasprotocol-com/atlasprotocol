import { useAppContext } from "@/app/context/app";

import { Button } from "../Button";
import { Dialog } from "../Dialog";

export interface RedeemPreviewProps {
  open: boolean;
  onClose: () => void;
  fromChain?: string;
  toChain?: string;
  amount?: number;
  toAddress?: string;
  onConfirm?: () => void;
  isPending?: boolean;
}

export function BridgePreview({
  open,
  onClose,
  amount,
  fromChain,
  toChain,
  toAddress,
  onConfirm,
  isPending,
}: RedeemPreviewProps) {
  const { ATLAS_BTC_TOKEN } = useAppContext();

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
            {amount || "--"} {ATLAS_BTC_TOKEN}
          </p>
        </div>
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">
            {ATLAS_BTC_TOKEN} Receiving Address
          </p>
          <p className=" text-base font-semibold break-all ">{toAddress}</p>
        </div>
      </div>

      <Button className="mt-4 w-full" onClick={onConfirm} disabled={isPending}>
        Process
      </Button>
    </Dialog>
  );
}
