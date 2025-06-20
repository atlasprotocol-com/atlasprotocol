import { useEffect, useMemo } from "react";
import { BsExclamationDiamondFill, BsInfoCircleFill } from "react-icons/bs";
import InfiniteScroll from "react-infinite-scroll-component";
import { useLocalStorage } from "usehooks-ts";

import { useAppContext } from "@/app/context/app";
import { useGetRedemptionHistory } from "@/app/hooks/history";
import {
  getStatusMessage,
  Redemptions,
  RedemptionStatus,
} from "@/app/types/redemptions";
import { getNetworkConfig } from "@/config/network.config";
import { useGetChainConfig } from "@/hooks";
import { satoshiToBtc } from "@/utils/btcConversions";
import { formatTimestamp } from "@/utils/getFormattedTimestamp";
import { calculateRedemptionHistoriesDiff } from "@/utils/local_storage/calculateRedemptionHistoriesDiff";
import { getRedemptionHistoriesLocalStorageKey } from "@/utils/local_storage/getRedemptionHistoriesLocalStorageKey";
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

function getStatusTooltipContent(status: any): string {
  switch (status) {
    case RedemptionStatus.ABTC_BURNT:
      return "Your redemption from Atlas is pending.";
    case RedemptionStatus.BTC_YIELD_PROVIDER_UNSTAKE_PROCESSING:
      return "Your BTC is in the process of being unstaked from the yield provider.";
    case RedemptionStatus.BTC_YIELD_PROVIDER_UNSTAKED:
      return "Your BTC has been unstaked from the yield provider.";
    case RedemptionStatus.BTC_YIELD_PROVIDER_WITHDRAWING:
      return "Your BTC is being withdrawn from the yield provider. This provider requires 7 confirmations on BTC Testnet4, so time can vary significantly.";
    case RedemptionStatus.BTC_YIELD_PROVIDER_WITHDRAWN:
      return "Your BTC has been successfully withdrawn from the yield provider back to Atlas.";
    case RedemptionStatus.BTC_REDEEMED_BACK_TO_USER:
      return "Your BTC has been successfully redeemed and sent to your wallet.";
    case RedemptionStatus.BTC_PENDING_REDEMPTION_FROM_ATLAS_TO_USER:
      return `Sending BTC back to user`;
    case RedemptionStatus.BTC_PENDING_MEMPOOL_CONFIRMATION:
      return `The BTC send transaction is pending.`;
    default:
      return "Unknown Status";
  }
}

export function RedeemHistory() {
  const { btcPublicKeyNoCoord, btcAddress, BTC_TOKEN } = useAppContext();
  const { mempoolApiUrl } = getNetworkConfig();
  const { data: chainConfigs = {} } = useGetChainConfig();

  const {
    data: redemptionHistories,
    fetchNextPage: fetchNextRedemptionHistoriesPage,
    hasNextPage: hasNextRedemptionHistoriesPage,
    isFetchingNextPage: isFetchingNextRedemptionHistoriesPage,
    error: redemptionHistoriesError,
    isError: hasRedemptionHistoriesError,
    refetch: refetchRedemptionHistoriesData,
  } = useGetRedemptionHistory({
    address: btcAddress,
    publicKeyNoCoord: btcPublicKeyNoCoord,
  });

  const redemptionHistoriesLocalStorageKey =
    getRedemptionHistoriesLocalStorageKey(btcPublicKeyNoCoord || "");

  const [redemptionHistoriesLocalStorage, setRedemptionHistoriesLocalStorage] =
    useLocalStorage<Redemptions[]>(redemptionHistoriesLocalStorageKey, []);

  const sortedRedemptionHistoriesData = useMemo(() => {
    // Combine redemptionHistories from the API and local storage, prioritizing API data
    const combinedRedemptionHistoriesData =
      redemptionHistories?.redemptionHistories
        ? [
            ...redemptionHistoriesLocalStorage,
            ...redemptionHistories.redemptionHistories,
          ]
        : // If no API data, fallback to using only local storage redemptionHistories
          redemptionHistoriesLocalStorage;

    // Sort the combined redemptionHistories by startTimestamp, newest records first
    return combinedRedemptionHistoriesData.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [redemptionHistories, redemptionHistoriesLocalStorage]);

  // Clean up the local storage redmeption
  useEffect(() => {
    if (!redemptionHistories?.redemptionHistories) {
      return;
    }

    const updateRedemptionHistoriesLocalStorage = async () => {
      const {
        areRedemptionHistoriesDifferent,
        redemptionHistories: newRedemptionHistories,
      } = await calculateRedemptionHistoriesDiff(
        redemptionHistories.redemptionHistories,
        redemptionHistoriesLocalStorage,
      );
      if (areRedemptionHistoriesDifferent) {
        setRedemptionHistoriesLocalStorage(newRedemptionHistories);
      }
    };

    updateRedemptionHistoriesLocalStorage();
  }, [
    redemptionHistories,
    setRedemptionHistoriesLocalStorage,
    redemptionHistoriesLocalStorage,
  ]);

  return (
    <Card>
      <h3 className="text-2xl font-bold">Redemption History</h3>
      <div className="mt-4">
        {sortedRedemptionHistoriesData.length === 0 ? (
          <div className="text-base font-normal text-neutral-7 text-center py-4 flex-col justify-center items-center gap-2 flex">
            <p className="text-center">No history found</p>
          </div>
        ) : (
          <>
            <div
              id="redeem-history-mobile"
              className="flex-col flex gap-4 no-scrollbar max-h-[600px] overflow-y-auto lg:hidden"
            >
              <InfiniteScroll
                className="flex flex-col gap-4 pt-3"
                dataLength={sortedRedemptionHistoriesData.length}
                next={fetchNextRedemptionHistoriesPage}
                hasMore={hasNextRedemptionHistoriesPage}
                loader={
                  isFetchingNextRedemptionHistoriesPage ? (
                    <LoadingTableList />
                  ) : null
                }
                scrollableTarget="redeem-history-mobile"
              >
                {sortedRedemptionHistoriesData.map((redeemHistory) => {
                  if (!redeemHistory) return null;
                  const chain =
                    chainConfigs[redeemHistory.abtcRedemptionChainId];

                  const netAmount =
                    redeemHistory.abtcAmount -
                    redeemHistory.protocolFee -
                    redeemHistory.yieldProviderGasFee -
                    redeemHistory.btcRedemptionFee;

                  return (
                    <div
                      key={redeemHistory.timestamp}
                      className="p-3 dark:bg-neutral-11 rounded-lg border border-neutral-5 dark:border-neutral-9 flex-col flex"
                    >
                      <div className="flex justify-between">
                        <span className=" px-2 py-0.5 bg-secondary-200 dark:bg-secondary-900 text-secondary-800 dark:text-secondary-700 rounded-[30px] justify-center items-center gap-px inline-flex text-[12px] font-semibold">
                          {getStatusMessage(redeemHistory.status)}
                        </span>
                        {redeemHistory.txnHash && (
                          <a
                            href={`${chain?.explorerURL}tx/${redeemHistory.txnHash.includes(",") ? redeemHistory.txnHash.split(",")[1] : redeemHistory.txnHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {trim(
                              redeemHistory.txnHash.includes(",")
                                ? redeemHistory.txnHash.split(",")[1]
                                : redeemHistory.txnHash,
                            )}
                          </a>
                        )}
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          Amount
                        </p>
                        <p>
                          {maxDecimals(satoshiToBtc(netAmount), 8)} {BTC_TOKEN}
                        </p>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <p className="font-semibold dark:text-neutral-7">
                          Redemption Chain
                        </p>
                        <p>{chain.networkName}</p>
                      </div>
                      <div className="flex justify-between text-sm  mt-1">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          Date
                        </p>
                        <p>{formatTimestamp(redeemHistory.timestamp)}</p>
                      </div>
                      <div className="flex justify-between text-sm  mt-1">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          Redemption Address
                        </p>
                        <p>{trim(redeemHistory.abtcRedemptionAddress)}</p>
                      </div>
                      <div className="flex justify-between text-sm  mt-1">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          BTC Tx Hash
                        </p>
                        <p>
                          {redeemHistory.btcTxnHash ? (
                            <a
                              href={`${chain?.explorerURL}/tx/${redeemHistory.btcTxnHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {trim(redeemHistory.btcTxnHash)}
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
                dataLength={sortedRedemptionHistoriesData.length}
                next={fetchNextRedemptionHistoriesPage}
                hasMore={hasNextRedemptionHistoriesPage}
                loader={
                  isFetchingNextRedemptionHistoriesPage ? (
                    <LoadingTableList />
                  ) : null
                }
                scrollableTarget="redeem-history"
              >
                <div
                  id="redeem-history"
                  className="no-scrollbar max-h-[600px] overflow-y-auto"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Redemption Chain</TableHead>
                        <TableHead>Redemption Address</TableHead>
                        <TableHead>Tx Hash</TableHead>
                        <TableHead>BTC Tx Hash</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRedemptionHistoriesData.map((redeemHistory) => {
                        if (!redeemHistory) return null;
                        const chain =
                          chainConfigs[redeemHistory.abtcRedemptionChainId];

                        const netAmount =
                          redeemHistory.abtcAmount -
                          redeemHistory.protocolFee -
                          redeemHistory.yieldProviderGasFee -
                          redeemHistory.btcRedemptionFee;

                        return (
                          <TableRow key={redeemHistory.timestamp}>
                            <TableCell>
                              <div
                                title={`Total Amount: ${maxDecimals(satoshiToBtc(redeemHistory.abtcAmount), 8)} BTC
Protocol Fee: ${maxDecimals(satoshiToBtc(redeemHistory.protocolFee), 8)} BTC
Yield Provider Gas Fee: ${maxDecimals(satoshiToBtc(redeemHistory.yieldProviderGasFee), 8)} BTC
BTC Redemption Fee: ${maxDecimals(satoshiToBtc(redeemHistory.btcRedemptionFee), 8)} BTC
Net Amount: ${maxDecimals(satoshiToBtc(netAmount), 8)} BTC`}
                              >
                                {maxDecimals(satoshiToBtc(netAmount), 8)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatTimestamp(redeemHistory.timestamp)}
                            </TableCell>
                            <TableCell>{chain.networkName}</TableCell>
                            <TableCell>
                              <span title={redeemHistory.abtcRedemptionAddress}>
                                {trim(redeemHistory.abtcRedemptionAddress)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <a
                                href={`${chain?.explorerURL}tx/${redeemHistory.txnHash.includes(",") ? redeemHistory.txnHash.split(",")[1] : redeemHistory.txnHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                title={
                                  redeemHistory.txnHash.includes(",")
                                    ? redeemHistory.txnHash.split(",")[1]
                                    : redeemHistory.txnHash
                                }
                              >
                                {trim(
                                  redeemHistory.txnHash.includes(",")
                                    ? redeemHistory.txnHash.split(",")[1]
                                    : redeemHistory.txnHash,
                                )}
                              </a>
                            </TableCell>
                            <TableCell>
                              {redeemHistory.btcTxnHash ? (
                                <a
                                  href={`${mempoolApiUrl}/tx/${redeemHistory.btcTxnHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                  title={redeemHistory.btcTxnHash}
                                >
                                  {trim(redeemHistory.btcTxnHash)}
                                </a>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {redeemHistory.remarks && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span className="text-red-500">
                                        <BsExclamationDiamondFill />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {redeemHistory.remarks}
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
                                        redeemHistory.status,
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                <span className=" px-2 py-0.5 bg-secondary-200 dark:bg-secondary-900 text-secondary-800 dark:text-secondary-700 rounded-[30px] justify-center items-center gap-px inline-flex text-[12px] font-semibold">
                                  {getStatusMessage(redeemHistory.status)}
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
