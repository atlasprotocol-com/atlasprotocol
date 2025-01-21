import { IoMdClose } from "react-icons/io";

import { getNetworkConfig } from "@/config/network.config";
import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";

import { GeneralModal } from "./GeneralModal";

interface PreviewModalProps {
  open: boolean;
  onClose: (value: boolean) => void;
  onSign: () => void;
  
  stakingAmountSat: number;
  stakingReceivingChain: string;
  stakingReceivingAddress: string;
  stakingFeeSat: number;
  feeRate: number;
  protocolFeeSat: number;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  open,
  onClose,
  stakingAmountSat,
  onSign,
  stakingFeeSat,
  stakingReceivingChain,
  stakingReceivingAddress,
  feeRate,
  protocolFeeSat,
}) => {
  const cardStyles =
    "card border bg-base-300 p-4 text-sm dark:border-0 dark:bg-base-200";

  const { coinName } = getNetworkConfig();

  return (
    <GeneralModal open={open} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold">Preview</h3>
        <button
          className="btn btn-circle btn-ghost btn-sm"
          onClick={() => onClose(false)}
        >
          <IoMdClose size={24} />
        </button>
      </div>
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-4 md:flex-row">
          
          <div className={`${cardStyles} flex-1`}>
            <p className="text-xs dark:text-neutral-content">Stake Amount</p>
            <p className="mb-3">{`${maxDecimals(satoshiToBtc(stakingAmountSat), 8)} ${coinName}`}</p>
            <p className="text-xs dark:text-neutral-content">aBTC Receiving Chain</p>
            <p className="mb-3">{`${stakingReceivingChain}`}</p>
            <p className="text-xs dark:text-neutral-content">Receiving Address</p>
            <p>{`${stakingReceivingAddress}`}</p>
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className={`${cardStyles} flex-1`}>
            <p className="text-xs dark:text-neutral-content">Fee rate</p>
            <p>{feeRate} sat/vB</p>
          </div>
          <div className={`${cardStyles} flex-1`}>
            <p className="text-xs dark:text-neutral-content">Transaction fee</p>
            <p>{`${maxDecimals(satoshiToBtc(stakingFeeSat), 8)} ${coinName}`}</p>
          </div>
          <div className={`${cardStyles} flex-1`}>
            <p className="text-xs dark:text-neutral-content">Protocol fee</p>
            <p>{`${maxDecimals(satoshiToBtc(protocolFeeSat ?? 0), 8)} ${coinName}`}</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            className="btn btn-outline flex-1"
            onClick={() => {
              onClose(false);
            }}
          >
            Cancel
          </button>
          <button className="btn-primary btn flex-1" onClick={onSign}>
            Stake
          </button>
        </div>
      </div>
    </GeneralModal>
  );
};
