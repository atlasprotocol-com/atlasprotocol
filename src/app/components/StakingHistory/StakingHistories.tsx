import { useEffect } from "react";
import InfiniteScroll from "react-infinite-scroll-component";

import { LoadingTableList } from "@/app/components/Loading/Loading";
import { QueryMeta } from "@/app/types/api";
import { Stakes as StakeInterface } from "@/app/types/stakes";

import { StakingHistory } from "./StakingHistory";

interface StakingHistoriesProps {
  stakingHistoriesAPI: StakeInterface[];
  stakingHistoriesLocalStorage: StakeInterface[];
  queryMeta: QueryMeta;
}

export const StakingHistories: React.FC<StakingHistoriesProps> = ({
  stakingHistoriesAPI,
  stakingHistoriesLocalStorage,
  queryMeta,
}) => {
  useEffect(() => {
    if (!stakingHistoriesAPI) {
      return;
    }
  }, [stakingHistoriesAPI]);

  // Combine stakingHistories from the API and local storage, prioritizing API data
  const combinedStakingHistoriesData = stakingHistoriesAPI
    ? [...stakingHistoriesLocalStorage, ...stakingHistoriesAPI]
    : // If no API data, fallback to using only local storage stakingHistories
      stakingHistoriesLocalStorage;

  // Sort the combined stakingHistories by startTimestamp, newest records first
  const sortedStakingHistoriesData = combinedStakingHistoriesData.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div className="card flex flex-col gap-2 bg-base-300 p-4 shadow-sm lg:flex-1">
      <h3 className="mb-4 font-bold">Staking History</h3>
      {sortedStakingHistoriesData.length === 0 ? (
        <div className="rounded-2xl border border-neutral-content p-4 text-center dark:border-neutral-content/20">
          <p>No history found</p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-7 gap-2 px-4 lg:grid">
            <p>Amount</p>
            <p>Date</p>
            <p>Receiving Chain</p>
            <p>Receiving Address</p>
            <p className="text-center">BTC Tnx hash</p>
            <p className="text-center">Mint Txn hash</p>
            <p className="text-center">Status</p>
          </div>
          <div
            id="staking-history"
            className="no-scrollbar max-h-[21rem] overflow-y-auto"
          >
            <InfiniteScroll
              className="flex flex-col gap-4 pt-3"
              dataLength={sortedStakingHistoriesData.length}
              next={queryMeta.next}
              hasMore={queryMeta.hasMore}
              loader={queryMeta.isFetchingMore ? <LoadingTableList /> : null}
              scrollableTarget="staking-history"
            >
              {sortedStakingHistoriesData?.map((stakingHistory) => {
                if (!stakingHistory) return null;
                const {
                  btcTxnHash,
                  btcSenderAddress,
                  receivingChainId,
                  receivingAddress,
                  btcAmount,
                  minted_txn_hash,
                  timestamp,
                  status,
                  remarks,
                } = stakingHistory;

                return (
                  <StakingHistory
                    key={btcTxnHash}
                    btcTxnHash={btcTxnHash}
                    btcSenderAddress={btcSenderAddress}
                    receivingChainId={receivingChainId}
                    receivingAddress={receivingAddress}
                    btcAmount={btcAmount}
                    minted_txn_hash={minted_txn_hash}
                    timestamp={timestamp}
                    status={status}
                    remarks={remarks}
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
