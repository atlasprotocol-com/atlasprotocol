import React, { useEffect, useState } from "react";
import { IoMdClose } from "react-icons/io";
import Web3 from "web3";

import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";
//import { getTxBridgingFees } from "@/utils/getTxBridgingFees";

import { GeneralModal } from "./GeneralModal";

interface BridgingPreviewModalProps {
  open: boolean;
  onClose: (value: boolean) => void;
  onSign: () => void;
  bridgingAmountSat: number;
  bridgingChain: string;
  bridgingAddress: string;
  bridgingReceivingAddress: string;
  ethBridgingFee: number;
  feeRate: number;
}

export const BridgingPreviewModal: React.FC<BridgingPreviewModalProps> = ({
  open,
  onClose,
  bridgingAmountSat,
  onSign,
  ethBridgingFee,
  bridgingChain,
  bridgingAddress,
  bridgingReceivingAddress,
  feeRate,
}) => {
  const [bridgingBTCfees, setBridgingBTCfees] = useState<number | null>(null);
  const [atlasBridgingFee, setAtlasBridgingFee] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const web3 = new Web3();

  useEffect(() => {
    const fetchBridgingFees = async () => {
      try {
        //const fees = await getTxBridgingFees(bridgingReceivingAddress, bridgingAmountSat, "0xDUMMY7f1e736d47dc5ef864f332b1155955ac3e8af7e219e24c11e6fd7dc9be7");
        const fees = 0;
        if (fees) {
         
          setBridgingBTCfees(0); // or whichever fee you need
          setAtlasBridgingFee(0);
        } else {
          setBridgingBTCfees(0);
          setAtlasBridgingFee(0);
        }
      } catch (error) {
        console.error("Failed to fetch bridging fees:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBridgingFees();
  }, [bridgingReceivingAddress, bridgingAmountSat]);

  const cardStyles =
    "card border bg-base-300 p-4 text-sm dark:border-0 dark:bg-base-200";

  const bridgingFeeEth = web3.utils.fromWei(ethBridgingFee.toString(), 'ether');

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
            <p className="text-xs dark:text-neutral-content">Bridging Chain</p>
            <p className="mb-3">{`${bridgingChain}`}</p>
            <p className="text-xs dark:text-neutral-content">Bridging Amount</p>
            <p className="mb-3">{`${maxDecimals(satoshiToBtc(bridgingAmountSat), 8)} aBTC`}</p>
            <p className="text-xs dark:text-neutral-content">BTC Receiving Address</p>
            <p>{`${bridgingReceivingAddress}`}</p>
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className={`${cardStyles} flex-1`}>
            <p className="text-xs dark:text-neutral-content">EVM Transaction fee</p>
            <p>{`${bridgingFeeEth} ETH`}</p>
          </div>
          <div className={`${cardStyles} flex-1`}>
            <p className="text-xs dark:text-neutral-content">BTC Transaction fee</p>
            <p>{`${maxDecimals(satoshiToBtc(bridgingBTCfees ? bridgingBTCfees: 0), 8)} BTC`}</p>
          </div>
          <div className={`${cardStyles} flex-1`}>
            <p className="text-xs dark:text-neutral-content">Atlas Protocol fee</p>
            <p>{`${maxDecimals(satoshiToBtc(atlasBridgingFee ? atlasBridgingFee: 0), 8)} BTC`}</p>
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
            Redeem
          </button>
        </div>
      </div>
    </GeneralModal>
  );
};
