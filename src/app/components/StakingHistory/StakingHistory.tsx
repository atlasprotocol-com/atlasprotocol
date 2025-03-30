import React, { useEffect } from "react";

import { getNetworkConfig } from "@/config/network.config";
import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";
import { trim } from "@/utils/trim";
import { formatTimestamp } from "@/utils/getFormattedTimestamp";
import { getStatusMessage, DepositStatus } from "@/app/types/stakes";
import { useChainConfig } from "@/app/context/api/ChainConfigProvider"; // Import useChainConfig hook


interface StakingHistoryProps {
  btcTxnHash: string;
  btcSenderAddress: string;
  receivingChainId: string;
  receivingAddress: string;
  btcAmount: number;
  minted_txn_hash: string;
  timestamp: string;
  status: number;
  remarks: string;
}

export const StakingHistory: React.FC<StakingHistoryProps> = ({
  btcTxnHash,
  btcSenderAddress,
  receivingChainId,
  receivingAddress,
  btcAmount,
  minted_txn_hash,
  timestamp,
  status,
  remarks,
}) => {

  const { coinName, mempoolApiUrl } = getNetworkConfig();
  const { chainConfigs } = useChainConfig(); // Get the chain configurations from context

  const chainConfig = chainConfigs ? chainConfigs[receivingChainId] : null;

  return (
    <div className="grid grid-flow-col grid-cols-2 grid-rows-2 items-center gap-2 lg:grid-flow-row lg:grid-cols-7 lg:grid-rows-1">
      <p>
        {maxDecimals(satoshiToBtc(btcAmount), 8)} {coinName} 
      </p>
      <p>{formatTimestamp(timestamp)}</p>
      <p>{chainConfig?.networkName}</p> {/* Use chainConfig from the context */}
      <p>{trim(receivingAddress)}</p>
      <div className="hidden justify-center lg:flex">
        <a
          href={`${mempoolApiUrl}/tx/${btcTxnHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {trim(btcTxnHash)}
        </a>
      </div>
      <div className="hidden justify-center lg:flex">
        <a
          href={`${chainConfig?.explorerURL}/tx/${minted_txn_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {minted_txn_hash ?  trim(minted_txn_hash) : ""}
        </a>
      </div>
      
      <div className="hidden justify-center lg:flex items-center">
        <p>{getStatusMessage(status)}</p>
        {remarks && (
          <span title={remarks} className="ml-1 text-blue-500 cursor-pointer">
            &#x1F61E; {/* Unicode character for exclamation mark */}
          </span>
        )}
      </div>
    </div>
  );
};
