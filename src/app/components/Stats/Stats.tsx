import Image from "next/image";
import { Fragment, useEffect, useState } from "react";

import { useGlobalParams } from "@/app/context/api/GlobalParamsProvider";
import {
  StakingStats,
  useStakingStats,
} from "@/app/context/api/StakingStatsProvider";
import { getNetworkConfig } from "@/config/network.config";
import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";

import confirmedTvl from "./icons/confirmed-tvl.svg";
import pendingStake from "./icons/pending-stake.svg";
import stakingTvlCap from "./icons/staking-tvl-cap.svg";

export const Stats: React.FC = () => {
  const [stakingStats, setStakingStats] = useState<StakingStats | undefined>({
    activeTVLSat: 0,
    totalTVLSat: 0,
    totalStakers: 0,
    unconfirmedTVLSat: 0,
  });
  const [stakingCapText, setStakingCapText] = useState<{
    title: string;
    value: string;
  }>({
    title: "Staking TVL Cap",
    value: "-",
  });
  const [isLoading, setIsLoading] = useState(true);
  const stakingStatsProvider = useStakingStats();
  const globalParams = useGlobalParams();

  const { coinName } = getNetworkConfig();

  // Load the data from staking stats provider and global params
  useEffect(() => {
    if (stakingStatsProvider.data) {
      setStakingStats(stakingStatsProvider.data);
    }

    if (globalParams.data && globalParams.data.length > 0) {
      const currentVersion = globalParams.data[0]; // Assuming you want the first version
      setStakingCapText({
        title: "Staking TVL Cap",
        value: `${maxDecimals(satoshiToBtc(currentVersion.stakingCapSat), 8)} ${coinName}`,
      });
    }

    setIsLoading(stakingStatsProvider.isLoading || globalParams.isLoading);
  }, [stakingStatsProvider, globalParams, coinName]);

  const sections = [
    [
      {
        title: stakingCapText.title,
        value: stakingCapText.value,
        icon: stakingTvlCap,
      },
      {
        title: "Confirmed TVL",
        value: stakingStats?.activeTVLSat
          ? `${maxDecimals(satoshiToBtc(stakingStats.activeTVLSat), 8)} ${coinName}`
          : 0,
        icon: confirmedTvl,
      },
      {
        title: "Pending Stake",
        value: stakingStats?.unconfirmedTVLSat
          ? `${maxDecimals(satoshiToBtc(stakingStats.unconfirmedTVLSat), 8)} ${coinName}`
          : 0,
        icon: pendingStake,
      },
    ],
  ];

  return (
    <div className="card flex flex-col gap-4 bg-base-300 p-1 shadow-sm">
      {sections.map((section, index) => (
        <div
          key={index}
          className="card flex justify-center bg-base-400 p-4 text-sm md:flex-row"
        >
          {section.map((subSection, subIndex) => (
            <Fragment key={subSection.title}>
              <div className="flex md:items-center gap-2 flex-col flex-wrap md:justify-center md:w-[160px]">
                <div className="flex items-center gap-2">
                  <Image src={subSection.icon} alt={subSection.title} />
                  <div className="flex items-center gap-1">
                    <p className="dark:text-neutral-content">
                      {subSection.title}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="flex-1">
                    {isLoading ? (
                      <span className="loading loading-spinner text-primary" />
                    ) : (
                      <strong>{subSection.value}</strong>
                    )}
                  </p>
                </div>
              </div>
              {subIndex !== section.length - 1 && (
                <div className="divider mx-0 my-2 md:divider-horizontal" />
              )}
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
};