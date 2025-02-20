import { useEffect, useMemo } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { useLocalStorage } from "usehooks-ts";

import { useAppContext } from "@/app/context/app";
import { useGetBridgeHistory } from "@/app/hooks/history";
import { useBridgeStore } from "@/app/stores/bridge";
import { BridgeHistory, getStatusMessage } from "@/app/types/bridge";
import { useGetChainConfig } from "@/hooks";
import { satoshiToBtc } from "@/utils/btcConversions";
import { formatTimestamp } from "@/utils/getFormattedTimestamp";
import { calculateBridgeHistoriesDiff } from "@/utils/local_storage/calculateBridgeHistoriesDiff";
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

const BridgeHistoryKey = "atlas-protocol-bridge";

// Get the local storage key for delegations
const getBridgeHistoriesLocalStorageKey = (pk: string) => {
  return pk ? `${BridgeHistoryKey}-${pk}` : "";
};

export function BridgeHistorySection() {
  const selectedAddress = useBridgeStore((state) => state.selectedAddress);
  const { data: chainConfigs = {} } = useGetChainConfig();
  const { BTC_TOKEN } = useAppContext();

  const {
    data: bridgeHistories,
    fetchNextPage: fetchNextBridgeHistoriesPage,
    hasNextPage: hasNextBridgeHistoriesPage,
    isFetchingNextPage: isFetchingNextBridgeHistoriesPage,
  } = useGetBridgeHistory({
    // address: "0x2564186c643B292d6A4215f5C33Aa69b213414dd",
    address: selectedAddress,
  });

  const bridgeHistoriesLocalStorageKey = getBridgeHistoriesLocalStorageKey(
    // "0x2564186c643B292d6A4215f5C33Aa69b213414dd",
    selectedAddress || "",
  );

  const [bridgeHistoriesLocalStorage, setBridgeHistoriesLocalStorage] =
    useLocalStorage<BridgeHistory[]>(bridgeHistoriesLocalStorageKey, []);

  // Combine bridgeHistories from the API and local storage, prioritizing API data
  const combinedBridgeHistoriesData = useMemo(() => {
    return bridgeHistories?.bridgeHistory
      ? [...bridgeHistoriesLocalStorage, ...bridgeHistories.bridgeHistory]
      : // If no API data, fallback to using only local storage bridgeHistories
        bridgeHistoriesLocalStorage;
  }, [bridgeHistories, bridgeHistoriesLocalStorage]);

  // Sort the combined bridgeHistories by startTimestamp, newest records first
  const sortedBridgeHistoriesData = useMemo(() => {
    return combinedBridgeHistoriesData.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [combinedBridgeHistoriesData]);

  // Clean up the local storage bridge
  useEffect(() => {
    if (!bridgeHistories?.bridgeHistory) {
      return;
    }

    const updateBridgeHistoriesLocalStorage = async () => {
      const {
        areBridgeHistoriesDifferent,
        bridgeHistories: newBridgeHistories,
      } = await calculateBridgeHistoriesDiff(
        bridgeHistories.bridgeHistory,
        bridgeHistoriesLocalStorage,
      );
      if (areBridgeHistoriesDifferent) {
        setBridgeHistoriesLocalStorage(newBridgeHistories);
      }
    };

    updateBridgeHistoriesLocalStorage();
  }, [
    bridgeHistories,
    setBridgeHistoriesLocalStorage,
    bridgeHistoriesLocalStorage,
  ]);

  return (
    <Card>
      <h3 className="text-2xl font-bold">Bridge History</h3>
      <div className="mt-4">
        {sortedBridgeHistoriesData.length === 0 ? (
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
                dataLength={sortedBridgeHistoriesData.length}
                next={fetchNextBridgeHistoriesPage}
                hasMore={hasNextBridgeHistoriesPage}
                loader={
                  isFetchingNextBridgeHistoriesPage ? (
                    <LoadingTableList />
                  ) : null
                }
                scrollableTarget="stake-history-mobile"
              >
                {sortedBridgeHistoriesData.map((bridgeHistory) => {
                  if (!bridgeHistory) return null;
                  const chain = chainConfigs[bridgeHistory.dest_chain_id];
                  const chainStart =
                    chainConfigs[bridgeHistory.origin_chain_id];

                  const chainStartExplorerURL = chainStart?.explorerURL;

                  const txnHash = bridgeHistory.txn_hash?.split(",")[1];

                  return (
                    <div
                      key={bridgeHistory.timestamp}
                      className="p-3 dark:bg-neutral-11 rounded-lg border border-neutral-5 dark:border-neutral-9 flex-col flex"
                    >
                      <div className="flex justify-between">
                        <span className=" px-2 py-0.5 bg-secondary-200 dark:bg-secondary-900 text-secondary-800 dark:text-secondary-700 rounded-[30px] justify-center items-center gap-px inline-flex text-[12px] font-semibold">
                          {getStatusMessage(bridgeHistory.status)}
                        </span>
                        {txnHash && (
                          <a
                            href={`${chainStartExplorerURL}tx/${txnHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {txnHash ? trim(txnHash) : "-"}
                          </a>
                        )}
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          Stake Amount
                        </p>
                        <p>
                          {maxDecimals(
                            satoshiToBtc(bridgeHistory.abtc_amount),
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
                        <p>
                          {formatTimestamp(
                            bridgeHistory.date_created.toString(),
                          )}
                        </p>
                      </div>
                      <div className="flex justify-between text-sm  mt-1">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          Receiving Address
                        </p>
                        <p>{trim(bridgeHistory.dest_chain_address)}</p>
                      </div>
                      <div className="flex justify-between text-sm  mt-1">
                        <p className="text-sm font-semibold dark:text-neutral-7">
                          Destination Tx Hash
                        </p>
                        <p>
                          {bridgeHistory.dest_txn_hash ? (
                            <a
                              href={`${chain?.explorerURL}tx/${bridgeHistory.dest_txn_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {trim(bridgeHistory.dest_txn_hash)}
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
                dataLength={sortedBridgeHistoriesData.length}
                next={fetchNextBridgeHistoriesPage}
                hasMore={hasNextBridgeHistoriesPage}
                loader={
                  isFetchingNextBridgeHistoriesPage ? (
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
                        <TableHead>Source Tx Hash</TableHead>
                        <TableHead>Destination Tx Hash</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedBridgeHistoriesData.map((bridgeHistory) => {
                        if (!bridgeHistory) return null;
                        const chain = chainConfigs[bridgeHistory.dest_chain_id];
                        const chainStart =
                          chainConfigs[bridgeHistory.origin_chain_id];

                        const chainStartExplorerURL = chainStart?.explorerURL;

                        const txnHash = bridgeHistory.txn_hash?.split(",")[1];
                        return (
                          <TableRow key={bridgeHistory.timestamp}>
                            <TableCell>
                              <div title={`Total Amount: ${maxDecimals(satoshiToBtc(bridgeHistory.abtc_amount), 8)} BTC
Protocol Fee: ${maxDecimals(satoshiToBtc(bridgeHistory.protocol_fee), 8)} BTC
Bridging Fee: ${maxDecimals(satoshiToBtc(bridgeHistory.yield_provider_gas_fee + bridgeHistory.minting_fee_sat), 8)} BTC
Net Amount: ${maxDecimals(satoshiToBtc(bridgeHistory.abtc_amount - bridgeHistory.protocol_fee - bridgeHistory.yield_provider_gas_fee - bridgeHistory.minting_fee_sat), 8)} BTC`}>
                                {maxDecimals(
                                  satoshiToBtc(bridgeHistory.abtc_amount - bridgeHistory.protocol_fee - bridgeHistory.yield_provider_gas_fee - bridgeHistory.minting_fee_sat),
                                  8,
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatTimestamp(
                                bridgeHistory.date_created.toString(),
                              )}
                            </TableCell>
                            <TableCell>{chain.networkName}</TableCell>
                            <TableCell>
                              {trim(bridgeHistory.dest_chain_address)}
                            </TableCell>
                            <TableCell>
                              <a
                                href={`${chainStartExplorerURL}tx/${txnHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {txnHash ? trim(txnHash) : "-"}
                              </a>
                            </TableCell>
                            <TableCell>
                              {bridgeHistory.dest_txn_hash ? (
                                <a
                                  href={`${chain?.explorerURL}tx/${bridgeHistory.dest_txn_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  {trim(bridgeHistory.dest_txn_hash)}
                                </a>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <span className=" px-2 py-0.5 bg-secondary-200 dark:bg-secondary-900 text-secondary-800 dark:text-secondary-700 rounded-[30px] justify-center items-center gap-px inline-flex text-[12px] font-semibold">
                                {getStatusMessage(bridgeHistory.status)}
                              </span>
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
