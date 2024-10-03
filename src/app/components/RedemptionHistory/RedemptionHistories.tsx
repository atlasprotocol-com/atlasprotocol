import { useEffect } from "react";
import InfiniteScroll from "react-infinite-scroll-component";

import { LoadingTableList } from "@/app/components/Loading/Loading";
import { QueryMeta } from "@/app/types/api";
import { Redemptions as RedemptionInterface } from "@/app/types/redemptions";

import { Redemption } from "./RedemptionHistory";

interface RedemptionHistoriesProps {
  redemptionHistoriesAPI: RedemptionInterface[];
  redemptionHistoriesLocalStorage: RedemptionInterface[];
  queryMeta: QueryMeta;
}

export const RedemptionHistories: React.FC<RedemptionHistoriesProps> = ({
  redemptionHistoriesAPI,
  redemptionHistoriesLocalStorage,
  queryMeta,
}) => {
  useEffect(() => {
    if (!redemptionHistoriesAPI) {
      return;
    }
  }, [redemptionHistoriesAPI]);

  // Combine redemptionHistories from the API and local storage, prioritizing API data
  const combinedRedemptionHistoriesData = redemptionHistoriesAPI
    ? [...redemptionHistoriesLocalStorage, ...redemptionHistoriesAPI]
    : // If no API data, fallback to using only local storage redemptionHistories
      redemptionHistoriesLocalStorage;

  // Sort the combined redemptionHistories by startTimestamp, newest records first
  const sortedRedemptionHistoriesData = combinedRedemptionHistoriesData.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="card flex flex-col gap-2 bg-base-300 p-4 shadow-sm lg:flex-1">
      <h3 className="mb-4 font-bold">Redemption history</h3>
      {sortedRedemptionHistoriesData.length === 0 ? (
        <div className="rounded-2xl border border-neutral-content p-4 text-center dark:border-neutral-content/20">
          <p>No history found</p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-7 gap-2 px-4 lg:grid">
            <p>Amount</p>
            <p>Date</p>
            <p>Redemption Chain</p>
            <p>Redemption Address</p>
            <p className="text-center">Tx hash</p>
            <p className="text-center">BTC tx hash</p>
            <p className="text-center">Status</p>
          </div>
          <div
            id="redemption-history"
            className="no-scrollbar max-h-[21rem] overflow-y-auto"
          >
            <InfiniteScroll
              className="flex flex-col gap-4 pt-3"
              dataLength={sortedRedemptionHistoriesData.length}
              next={queryMeta.next}
              hasMore={queryMeta.hasMore}
              loader={queryMeta.isFetchingMore ? <LoadingTableList /> : null}
              scrollableTarget="redemption-history"
            >
              {sortedRedemptionHistoriesData?.map((redemption) => {
                if (!redemption) return null;
                const {
                  txnHash,
                  abtcRedemptionAddress,
                  abtcRedemptionChainId,
                  btcReceivingAddress,
                  abtcAmount,
                  timestamp,
                  status,
                  remarks,
                  btcTxnHash,
                } = redemption;

                return (
                  <Redemption
                    key={txnHash}
                    txnHash={txnHash}
                    abtcRedemptionAddress={abtcRedemptionAddress}
                    abtcRedemptionChainId={abtcRedemptionChainId}
                    btcReceivingAddress={btcReceivingAddress}
                    abtcAmount={abtcAmount}
                    timestamp={timestamp}
                    status={status}
                    remarks={remarks}
                    btcTxnHash={btcTxnHash}
                  />
                );
              })}
            </InfiniteScroll>
          </div>
        </>
      )}
    </div>
  );
};
