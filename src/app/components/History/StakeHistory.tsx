import { useEffect, useMemo } from "react";
import { BsExclamationDiamondFill, BsInfoCircleFill } from "react-icons/bs";
import InfiniteScroll from "react-infinite-scroll-component";
import { useLocalStorage } from "usehooks-ts";

import { ATLAS_BTC_TOKEN, useAppContext } from "@/app/context/app";
import { useGetStakingHistory } from "@/app/hooks/history";
import { DepositStatus, getStatusMessage, Stakes } from "@/app/types/stakes";
import { getNetworkConfig } from "@/config/network.config";
import { useGetChainConfig } from "@/hooks";
import { satoshiToBtc } from "@/utils/btcConversions";
import { formatTimestamp } from "@/utils/getFormattedTimestamp";
import { calculateStakingHistoriesDiff } from "@/utils/local_storage/calculateStakingHistoriesDiff";
import { getStakingHistoriesLocalStorageKey } from "@/utils/local_storage/getStakingHistoriesLocalStorageKey";
import { maxDecimals } from "@/utils/maxDecimals";
import { trim } from "@/utils/trim";

import { Card } from "../Card";
import { LoadingTableList } from "../Loading/Loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../Table";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip";

interface StakeHistoryWithAmountInfo extends Stakes {
  amountInfo: {
    totalAmount: number;
    protocolFee: number;
    mintingFee: number;
    yieldProviderGasFee: number;
    netAmount: number;
  };
}

const getStatusTooltipContent = (status: any) => {
  switch (status) {
    case DepositStatus.BTC_PENDING_DEPOSIT_MEMPOOL:
      return "Your deposit into Atlas is pending on the BTC network.  This step requires 1 confirmation on BTC Testnet4";
    case DepositStatus.BTC_DEPOSITED_INTO_ATLAS:
      return "Your deposit into Atlas has been confirmed and will next be sent to Yield Provider.";
    case DepositStatus.BTC_PENDING_YIELD_PROVIDER_DEPOSIT:
      return "Your deposit into the yield provider protocol is pending on the BTC network.  This provider requires 7 confirmations on BTC Testnet4, so time can vary significantly.";
    case DepositStatus.BTC_YIELD_PROVIDER_DEPOSITED:
      return "Your deposit has been confirmed with the yield provider.";
    case DepositStatus.BTC_PENDING_MINTED_INTO_ABTC:
      return `Your ${ATLAS_BTC_TOKEN} is being minted on the destination chain.`;
    case DepositStatus.BTC_MINTED_INTO_ABTC:
      return `Your ${ATLAS_BTC_TOKEN} can now be found in your destination wallet.`;
    default:
      return "";
  }
};

export function StakeHistory() {
  const { btcPublicKeyNoCoord, btcAddress, BTC_TOKEN } = useAppContext();
  const { mempoolApiUrl } = getNetworkConfig();
  const { data: chainConfigs = {} } = useGetChainConfig();

  const {
    data: stakingHistories,
    fetchNextPage: fetchNextStakingHistoriesPage,
    hasNextPage: hasNextStakingHistoriesPage,
    isFetchingNextPage: isFetchingNextStakingHistoriesPage,
  } = useGetStakingHistory({
    address: btcAddress,
    publicKeyNoCoord: btcPublicKeyNoCoord,
  });

  const stakingHistoriesLocalStorageKey = getStakingHistoriesLocalStorageKey(
    btcPublicKeyNoCoord || "",
  );

  const [stakingHistoriesLocalStorage, setStakingHistoriesLocalStorage] =
    useLocalStorage<Stakes[]>(stakingHistoriesLocalStorageKey, []);

  // Combine stakingHistories from the API and local storage, prioritizing API data
  const combinedStakingHistoriesData = useMemo(() => {
    return stakingHistories?.stakingHistories
      ? [...stakingHistoriesLocalStorage, ...stakingHistories.stakingHistories]
      : // If no API data, fallback to using only local storage stakingHistories
        stakingHistoriesLocalStorage;
  }, [stakingHistories, stakingHistoriesLocalStorage]);

  // Sort the combined stakingHistories by startTimestamp, newest records first
  const sortedStakingHistoriesData = useMemo<
    StakeHistoryWithAmountInfo[]
  >(() => {
    return combinedStakingHistoriesData
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .map((stakingHistory) => ({
        ...stakingHistory,
        amountInfo: getStakeAmountInfo(stakingHistory),
      }));
  }, [combinedStakingHistoriesData]);

  // Clean up the local storage staking
  useEffect(() => {
    if (!stakingHistories?.stakingHistories) {
      return;
    }

    const updateStakingHistoriesLocalStorage = async () => {
      const {
        areStakingHistoriesDifferent,
        stakingHistories: newStakingHistories,
      } = await calculateStakingHistoriesDiff(
        stakingHistories.stakingHistories,
        stakingHistoriesLocalStorage,
      );
      if (areStakingHistoriesDifferent) {
        setStakingHistoriesLocalStorage(newStakingHistories);
      }
    };

    updateStakingHistoriesLocalStorage();
  }, [
    stakingHistories,
    setStakingHistoriesLocalStorage,
    stakingHistoriesLocalStorage,
  ]);

  function getStakeAmountInfo(stakingHistory: Stakes) {
    return {
      totalAmount: maxDecimals(
        satoshiToBtc(
          stakingHistory.btcAmount +
            stakingHistory.protocolFee +
            stakingHistory.mintingFee,
        ),
        8,
      ),
      protocolFee: maxDecimals(satoshiToBtc(stakingHistory.protocolFee), 8),
      mintingFee: maxDecimals(satoshiToBtc(stakingHistory.mintingFee), 8),
      yieldProviderGasFee: maxDecimals(
        satoshiToBtc(stakingHistory.yieldProviderGasFee),
        8,
      ),
      netAmount: maxDecimals(
        satoshiToBtc(
          stakingHistory.btcAmount - stakingHistory.yieldProviderGasFee,
        ),
        8,
      ),
    };
  }

  return (
    <Card>
      <h3 className="text-2xl font-bold">Staking History</h3>
      <div className="mt-4">
        {sortedStakingHistoriesData.length === 0 ? (
          <div className="text-base font-normal text-neutral-7 text-center py-4 flex-col justify-center items-center gap-2 flex">
            <p className="text-center">No history found</p>
          </div>
        ) : (
          <>
            <div
              id="stake-history-mobile"
              className="flex-col flex gap-4 no-scrollbar max-h-[600px] overflow-y-auto lg:hidden"
            >
              <InfiniteScroll
                className="flex flex-col gap-4 pt-3"
                dataLength={sortedStakingHistoriesData.length}
                next={fetchNextStakingHistoriesPage}
                hasMore={hasNextStakingHistoriesPage}
                loader={
                  isFetchingNextStakingHistoriesPage ? (
                    <LoadingTableList />
                  ) : null
                }
                scrollableTarget="stake-history-mobile"
              >
                {sortedStakingHistoriesData.map((stakingHistory) => {
                  if (!stakingHistory) return null;
                  const chain = chainConfigs[stakingHistory.receivingChainId];
                  return (
                    <div
                      key={stakingHistory.timestamp}
                      className="p-3 dark:bg-neutral-11 rounded-lg border border-neutral-5 dark:border-neutral-9 flex-col flex"
                    >
                      <div className="flex justify-between">
                        <span className=" px-2 py-0.5 bg-secondary-200 dark:bg-secondary-900 text-secondary-800 dark:text-secondary-700 rounded-[30px] justify-center items-center gap-px inline-flex text-[12px] font-semibold">
                          {getStatusMessage(stakingHistory.status)}
                        </span>
                        {stakingHistory.btcTxnHash && (
                          <a
                            href={`${process.env.NEXT_PUBLIC_MEMPOOL_EXPLORER}/tx/${stakingHistory.btcTxnHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {stakingHistory.btcTxnHash
                              ? trim(stakingHistory.btcTxnHash)
                              : "-"}
                          </a>
                        )}
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          Stake Amount
                        </p>
                        <p>
                          {maxDecimals(
                            satoshiToBtc(stakingHistory.btcAmount),
                            8,
                          )}{" "}
                          {BTC_TOKEN}
                        </p>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <p className="font-semibold dark:text-neutral-7">
                          Receiving Chain
                        </p>
                        <p>{chain.networkName}</p>
                      </div>
                      <div className="flex justify-between text-sm  mt-1">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          Date
                        </p>
                        <p>{formatTimestamp(stakingHistory.timestamp)}</p>
                      </div>
                      <div className="flex justify-between text-sm  mt-1">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          Receiving Address
                        </p>
                        <p>{trim(stakingHistory.receivingAddress)}</p>
                      </div>
                      <div className="flex justify-between text-sm  mt-1">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          BTC Tx Hash
                        </p>
                        <p>
                          {stakingHistory.minted_txn_hash ? (
                            <a
                              href={`${chain?.explorerURL}/tx/${stakingHistory.minted_txn_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {trim(stakingHistory.minted_txn_hash)}
                            </a>
                          ) : (
                            "-"
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </InfiniteScroll>
            </div>
            <div className="hidden lg:block">
              <InfiniteScroll
                className="flex flex-col gap-4 pt-3"
                dataLength={sortedStakingHistoriesData.length}
                next={fetchNextStakingHistoriesPage}
                hasMore={hasNextStakingHistoriesPage}
                loader={
                  isFetchingNextStakingHistoriesPage ? (
                    <LoadingTableList />
                  ) : null
                }
                scrollableTarget="stake-history"
              >
                <div
                  id="stake-history"
                  className="no-scrollbar max-h-[600px] overflow-y-auto"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Receiving Chain</TableHead>
                        <TableHead>Receiving Address</TableHead>
                        <TableHead>BTC Tx Hash</TableHead>
                        <TableHead>Tx Hash</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedStakingHistoriesData.map((stakingHistory) => {
                        if (!stakingHistory) return null;
                        const chain =
                          chainConfigs[stakingHistory.receivingChainId];
                        return (
                          <TableRow key={stakingHistory.timestamp}>
                            <TableCell>
                              <div className="flex  gap-1">
                                <div className="flex  gap-1">
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span>
                                        <BsInfoCircleFill />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div>
                                        <p>
                                          Total {BTC_TOKEN} Sent:{" "}
                                          {
                                            maxDecimals(stakingHistory.amountInfo.totalAmount + stakingHistory.amountInfo.yieldProviderGasFee, 8)
                                          }{" "}
                                          {BTC_TOKEN}
                                        </p>
                                        <p>
                                          BTC Network Fee (Atlas):{" "}
                                          {
                                            stakingHistory.amountInfo
                                              .yieldProviderGasFee
                                          }{" "}
                                          {BTC_TOKEN}
                                        </p>
                                        <p>
                                          Protocol Fee:{" "}
                                          {
                                            stakingHistory.amountInfo
                                              .protocolFee
                                          }{" "}
                                          {BTC_TOKEN}
                                        </p>
                                        <p>
                                          estination Chain Network Fee:{" "}
                                          {stakingHistory.amountInfo.mintingFee}{" "}
                                          {BTC_TOKEN}
                                        </p>
                                        <p>
                                          BTC Network Fee (Staking Provider):{" "}
                                          {
                                            stakingHistory.amountInfo
                                              .yieldProviderGasFee
                                          }{" "}
                                          {BTC_TOKEN}
                                        </p>
                                        <p>
                                          Net Amount:{" "}
                                          {stakingHistory.amountInfo.netAmount}{" "}
                                          {BTC_TOKEN}
                                        </p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                {maxDecimals(
                                  satoshiToBtc(
                                    stakingHistory.btcAmount -
                                      stakingHistory.yieldProviderGasFee,
                                  ),
                                  8,
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatTimestamp(stakingHistory.timestamp)}
                            </TableCell>
                            <TableCell>{chain.networkName}</TableCell>
                            <TableCell>
                              <span title={stakingHistory.receivingAddress}>
                                {trim(stakingHistory.receivingAddress)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <a
                                href={`${mempoolApiUrl}/tx/${stakingHistory.btcTxnHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                title={stakingHistory.btcTxnHash || "-"}
                              >
                                {stakingHistory.btcTxnHash
                                  ? trim(stakingHistory.btcTxnHash)
                                  : "-"}
                              </a>
                            </TableCell>
                            <TableCell>
                              {stakingHistory.minted_txn_hash ? (
                                <a
                                  href={`${chain?.explorerURL}/tx/${stakingHistory.minted_txn_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                  title={stakingHistory.minted_txn_hash}
                                >
                                  {trim(stakingHistory.minted_txn_hash)}
                                </a>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {stakingHistory.remarks && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span className="text-red-500">
                                        <BsExclamationDiamondFill />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {stakingHistory.remarks}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span>
                                      <BsInfoCircleFill />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="max-w-[300px]">
                                      {getStatusTooltipContent(
                                        stakingHistory.status,
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                <span className=" px-2 py-0.5 bg-secondary-200 dark:bg-secondary-900 text-secondary-800 dark:text-secondary-700 rounded-[30px] justify-center items-center gap-px inline-flex text-[12px] font-semibold">
                                  {getStatusMessage(stakingHistory.status)}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </InfiniteScroll>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
