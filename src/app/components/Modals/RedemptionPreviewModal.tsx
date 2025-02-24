import React, { useEffect, useState } from "react";
import { IoMdClose } from "react-icons/io";
import Web3 from "web3";

import { ChainConfig } from "@/app/types/chainConfig";
import { satoshiToBtc } from "@/utils/btcConversions";
import { getTxRedemptionFees } from "@/utils/getTxRedemptionFees";
import { maxDecimals } from "@/utils/maxDecimals";

import { GeneralModal } from "./GeneralModal";

interface RedemptionPreviewModalProps {
  open: boolean;
  onClose: (value: boolean) => void;
  onSign: () => void;
  redemptionAmountSat: number;
  redemptionChain?: ChainConfig;
  redemptionAddress: string;
  redemptionReceivingAddress: string;
  redemptionFee: number;
  feeRate: number;
}

export const RedemptionPreviewModal: React.FC<RedemptionPreviewModalProps> = ({
  open,
  onClose,
  redemptionAmountSat,
  onSign,
  redemptionFee,
  redemptionChain,
  redemptionAddress,
  redemptionReceivingAddress,
  feeRate,
}) => {
  const [redemptionBTCfees, setRedemptionBTCfees] = useState<number | null>(
    null,
  );
  const [atlasProtocolFee, setAtlasProtocolFee] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isButtonDisabled, setIsButtonDisabled] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const web3 = new Web3();
  const isNearChain = redemptionChain?.networkType === "NEAR";

  useEffect(() => {
    setErrorMessage("");

    const fetchRedemptionFees = async () => {
      try {
        const fees = await getTxRedemptionFees(redemptionAmountSat);
        console.log(fees);
        if (fees) {
          setRedemptionBTCfees(fees.estimatedRedemptionFee); // or whichever fee you need
          setAtlasProtocolFee(fees.atlasProtocolFee);
          setIsButtonDisabled(false);
        } else {
          setRedemptionBTCfees(0);
          setAtlasProtocolFee(0);
          setIsButtonDisabled(true);
          setErrorMessage("Failed to retrieve redemption fees.");
        }
      } catch (error) {
        console.error("Failed to fetch redemption fees:", error);
        setIsButtonDisabled(true);
        setErrorMessage("Failed to retrieve redemption fees.");
      } finally {
        setLoading(false);
      }
    };

    fetchRedemptionFees();
  }, [redemptionAmountSat]);

  useEffect(() => {
    if (isNearChain) {
      setIsButtonDisabled(false);
      setLoading(false);
      setErrorMessage("");
    }
  }, [isNearChain]);

  const cardStyles =
    "card border bg-base-300 p-4 text-sm dark:border-0 dark:bg-base-200";

  const redemptionFeeEth = web3.utils.fromWei(
    redemptionFee.toString(),
    "ether",
  );

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
            <p className="text-xs dark:text-neutral-content">
              Redemption Chain
            </p>
            <p className="mb-3">{`${redemptionChain?.networkName}`}</p>
            <p className="text-xs dark:text-neutral-content">
              Redemption Amount
            </p>
            <p className="mb-3">{`${maxDecimals(satoshiToBtc(redemptionAmountSat), 8)} aBTC`}</p>
            <p className="text-xs dark:text-neutral-content">
              BTC Receiving Address
            </p>
            <p>{`${redemptionReceivingAddress}`}</p>
          </div>
        </div>
        {!isNearChain && (
          <div className="flex flex-col gap-4 md:flex-row">
            <div className={`${cardStyles} flex-1`}>
              <p className="text-xs dark:text-neutral-content">
                EVM Transaction fee
              </p>
              <p>{`${redemptionFeeEth} ETH`}</p>
            </div>
            <div className={`${cardStyles} flex-1`}>
              <p className="text-xs dark:text-neutral-content">
                BTC Transaction fee
              </p>
              <p>{`${maxDecimals(satoshiToBtc(redemptionBTCfees ? redemptionBTCfees : 0), 8)} BTC`}</p>
            </div>
            <div className={`${cardStyles} flex-1`}>
              <p className="text-xs dark:text-neutral-content">
                Atlas Protocol fee
              </p>
              <p>{`${maxDecimals(satoshiToBtc(atlasProtocolFee ? atlasProtocolFee : 0), 8)} BTC`}</p>
            </div>
          </div>
        )}
        <div className="flex gap-4">
          <button
            className="btn btn-outline flex-1"
            onClick={() => {
              onClose(false);
            }}
          >
            Cancel
          </button>
          <button
            className="btn-primary btn flex-1"
            onClick={onSign}
            disabled={isButtonDisabled}
          >
            Redeem
          </button>
        </div>
        {errorMessage && (
          <div className="mt-4 text-center text-red-500">{errorMessage}</div>
        )}
      </div>
    </GeneralModal>
  );
};
