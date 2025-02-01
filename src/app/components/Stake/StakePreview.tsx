import { useAppContext } from "@/app/context/app";
import { useGetStats } from "@/hooks/stats";

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
  mintingFee?: number;
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
  mintingFee,
  onConfirm,
  isPending, 
}: StakePreviewProps) {
  const { BTC_TOKEN, ATLAS_BTC_TOKEN } = useAppContext();
  const { data: stats } = useGetStats();
  const btcPriceUsd = stats?.btcPriceUsd || 0;

  const actualAtBTCReceived = stakingAmount && stakingFee && protocolFee!==undefined && mintingFee
    ? Number(((stakingAmount - stakingFee - protocolFee - mintingFee) / 100000000).toFixed(8))
    : "--";

  const stakingAmountBtc = stakingAmount ? stakingAmount / 100000000 : 0;
  const stakingFeeBtc = stakingFee ? stakingFee / 100000000 : 0;

  const actualAtBTCReceivedUsd = actualAtBTCReceived !== '--' && btcPriceUsd
    ? (actualAtBTCReceived * btcPriceUsd).toFixed(2)
    : '--';

  const stakingAmountUsd = stakingAmountBtc && btcPriceUsd
    ? (stakingAmountBtc * btcPriceUsd).toFixed(2)
    : '--';

  const stakingFeeUsd = stakingFeeBtc && btcPriceUsd
    ? (stakingFeeBtc * btcPriceUsd).toFixed(2)
    : '--';

  const protocolFeeUsd = protocolFee && btcPriceUsd
    ? ((protocolFee / 100000000) * btcPriceUsd).toFixed(2)
    : '--';

  const mintingFeeUsd = mintingFee && btcPriceUsd
    ? ((mintingFee / 100000000) * btcPriceUsd).toFixed(2)
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
            <p className="text-caption text-sm font-semibold">Stake Amount</p>
            <p className="text-base font-semibold">
              {stakingAmountBtc || "--"}{BTC_TOKEN} <span className="text-sm text-neutral-7">(≈{stakingAmountUsd} USD)</span>
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
        <div className="mt-4">
          <p className="text-caption text-sm font-semibold">Actual Received</p>
          <p className="text-base font-semibold break-all">
            {actualAtBTCReceived} {ATLAS_BTC_TOKEN} <span className="text-sm text-neutral-7">(≈{actualAtBTCReceivedUsd} USD)</span>
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
          <p className="text-caption text-sm font-semibold">Staking Fee</p>
          <p className="text-base font-semibold break-all">
            {stakingFeeBtc.toFixed(8) || "--"} <br />
            {BTC_TOKEN} <span className="text-sm text-neutral-7"><br />
            (≈{stakingFeeUsd} USD)</span>
          </p>
        </div>
        <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
          <p className="text-caption text-sm font-semibold">Minting Fee</p>
          <p className="text-base font-semibold break-all">
            {mintingFee ? (mintingFee / 100000000).toFixed(8) : "--"}<br />
            {BTC_TOKEN} <span className="text-sm text-neutral-7"><br />
            (≈{mintingFeeUsd} USD)</span>
          </p>
        </div>
        <div className="rounded-lg border border-neutral-5  dark:border-neutral-8 dark:bg-neutral-10 p-3 flex-1">
          <p className="text-caption text-sm font-semibold">Protocol Fee</p>
          <p className="text-base font-semibold break-all">
            {protocolFee ? (protocolFee / 100000000).toFixed(8) : "--"} <br />
            {BTC_TOKEN} <span className="text-sm text-neutral-7"><br />
            (≈{protocolFeeUsd} USD)</span>
          </p>
        </div>
      </div>
      <Button className="mt-4 w-full" onClick={onConfirm} disabled={isPending}>
        Stake
      </Button>
    </Dialog>
  );
}
