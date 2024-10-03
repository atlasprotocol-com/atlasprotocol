import React, { useEffect } from "react";

import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";
import { trim } from "@/utils/trim";
import { formatTimestamp } from "@/utils/getFormattedTimestamp";
import { getStatusMessage, RedemptionStatus } from "@/app/types/redemptions";
import { useChainConfig } from "@/app/context/api/ChainConfigProvider"; // Import useChainConfig hook
import { getNetworkConfig } from "@/config/network.config";
interface RedemptionProps {
  txnHash: string;
  abtcRedemptionAddress: string;
  abtcRedemptionChainId: string;
  btcReceivingAddress: string;
  abtcAmount: number;
  timestamp: string;
  status: string;
  remarks: string;
  btcTxnHash: string;
}

export const Redemption: React.FC<RedemptionProps> = ({
  txnHash,
  abtcRedemptionAddress,
  abtcRedemptionChainId,
  btcReceivingAddress,
  abtcAmount,
  timestamp,
  status,
  remarks,
  btcTxnHash,
}) => {
  const { mempoolApiUrl } = getNetworkConfig();
  const { chainConfigs } = useChainConfig(); // Use chainConfigs from the context
  const chainConfig = chainConfigs ? chainConfigs[abtcRedemptionChainId] : null;
  return (
    <div className="grid grid-flow-col grid-cols-2 grid-rows-2 items-center gap-2 lg:grid-flow-row lg:grid-cols-7 lg:grid-rows-1">
      <p>
        {maxDecimals(satoshiToBtc(abtcAmount), 8)} aBTC
      </p>
      <p>{formatTimestamp(timestamp)}</p>
      <p>{chainConfig?.networkName}</p> {/* Use chainConfig from the context */}
      <p>{trim(abtcRedemptionAddress)}</p>
      <div className="hidden justify-center lg:flex">
      <a
        href={`${chainConfig?.explorerURL}tx/${txnHash.includes(',') ? txnHash.split(',')[1] : txnHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {trim(txnHash.includes(',') ? txnHash.split(',')[1] : txnHash)}
      </a>
      </div>

      <div className="hidden justify-center lg:flex">
      <a
          href={`${mempoolApiUrl}/tx/${btcTxnHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
        {btcTxnHash ? trim(btcTxnHash) : ""}
      </a>
      </div>
      <div className="hidden justify-center lg:flex">
        {getStatusMessage(status)}
        {remarks && (
          <span title={remarks} className="ml-1 text-blue-500 cursor-pointer">
            &#x1F61E; {/* Unicode character for exclamation mark */}
          </span>
        )}
      </div>
    </div>
  );
};
