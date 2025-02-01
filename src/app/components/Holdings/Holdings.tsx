import { useMemo } from "react";
import { FaBitcoin } from "react-icons/fa";
import { twMerge } from "tailwind-merge";

import { useAppContext } from "@/app/context/app";
import {
  useGetRedemptionHistory,
  useGetStakingHistory,
} from "@/app/hooks/history";
import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";
import { trim } from "@/utils/trim";

import { Card } from "../Card";

function Holding({
  label,
  value,
  address,
  type,
}: {
  label: string;
  value: string | number;
  address?: string;
  type?: "balance";
}) {
  const { BTC_TOKEN } = useAppContext();
  return (
    <div
      className={twMerge(
        "p-3 bg-neutral-3 dark:bg-neutral-11 rounded-lg",
        type === "balance" &&
          "border border-primary bg-primary-100 dark:bg-[#f35c1e]/10",
      )}
    >
      <div className=" justify-between items-center gap-2 flex">
        <div className="flex items-center gap-1">
          <FaBitcoin className="text-secondary-700" size={16} />
          <p className="text-sm text-neutral-content">{label}</p>
        </div>
        <p
          className={twMerge(
            "whitespace-nowrap font-bold",
            type === "balance" && "text-primary",
          )}
        >
          {value} <span className="font-normal">{BTC_TOKEN}</span>
        </p>
      </div>
      {address && (
        <div className="flex justify-end mt-1">
          <div className="text-secondary-100 dark:text-secondary-700 px-1 py-0.5 bg-secondary-700 dark:bg-secondary-900 rounded-[30px] justify-center items-center gap-px inline-flex text-[12px]">
            {address}
          </div>
        </div>
      )}
    </div>
  );
}

export function Holdings({ balanceSat }: { balanceSat: number }) {
  const { btcAddress, btcPublicKeyNoCoord } = useAppContext();
  const { data: stakingHistories } = useGetStakingHistory({
    address: btcAddress,
    publicKeyNoCoord: btcPublicKeyNoCoord,
  });

  const { data: redemptionHistories } = useGetRedemptionHistory({
    address: btcAddress,
    publicKeyNoCoord: btcPublicKeyNoCoord,
  });

  const data = useMemo(() => {
    let totalStakedSat = 0;
    let totalRedeemedSat = 0;

    if (stakingHistories) {
      totalStakedSat = stakingHistories.stakingHistories.reduce(
        (accumulator: number, item) => accumulator + item?.btcAmount - item?.yieldProviderGasFee,
        0,
      );
    }

    if (redemptionHistories) {
      totalRedeemedSat = redemptionHistories.redemptionHistories.reduce(
        (accumulator: number, item) => accumulator + item?.abtcAmount,
        0,
      );
    }
    return {
      totalStakedSat,
      formattedTotalStaked: maxDecimals(satoshiToBtc(totalStakedSat), 8),
      totalRedeemedSat,
      formattedTotalRedeemed: maxDecimals(satoshiToBtc(totalRedeemedSat), 8),
      formattedBalance: maxDecimals(satoshiToBtc(balanceSat), 8),
    };
  }, [stakingHistories, redemptionHistories, balanceSat]);

  return (
    <Card className="h-full">
      <h3 className="text-2xl font-bold">My Holdings</h3>
      <div className="flex flex-col gap-4 mt-4">
        <Holding label="Total Staked" value={data.formattedTotalStaked} />
        <Holding label="Total Redeemed" value={data.formattedTotalRedeemed} />
        <Holding
          label="Balance"
          value={data.formattedBalance}
          address={trim(btcAddress || "")}
          type="balance"
        />
      </div>
      {/* <div className="mt-4 flex justify-center p-2">
        <a
          href="https://signetfaucet.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary hover:underline flex items-center gap-2"
        >
          Get Test Tokens <LuArrowRight fontSize={24} />
        </a>
      </div> */}
    </Card>
  );
}
