import atbtcImage from "@/app/assets/atbtc.png";
import Image from "next/image";
import { useMemo } from "react";

import { useAppContext } from "@/app/context/app";
import { useGetGlobalParams, useGetStats } from "@/hooks/stats";
import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";

import { Card } from "../Card";

import { LockIcon } from "./icons/Lock";
import { StakeIcon } from "./icons/Stake";

function CardStat({
  icon,
  title,
  value,
  valueUnit,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  valueUnit?: string;
}) {
  return (
    <Card className="flex gap-4">
      <div className="w-14 h-14 rounded-full bg-[#FEF3DE] dark:bg-neutral-11 flex justify-center items-center text-[36px]">
        {icon}
      </div>
      <div>
        <p className="text-caption">{title}</p>
        <p className="text-base">
          <span className="text-2xl font-bold">{value}</span> {valueUnit ?? ""}
        </p>
      </div>
    </Card>
  );
}

export const Stats: React.FC = () => {
  const globalParams = useGetGlobalParams();
  const stats = useGetStats();
  const {
    BTC_TOKEN,
    ATLAS_BTC_TOKEN,
    btcWallet,
    btcAddress,
    btcPublicKeyNoCoord,
    btcNetwork,
    btcRefreshBalance,
  } = useAppContext();

  const statsValue = useMemo(() => {
    if (!stats.data) return null;

    const statsData = stats.data;
    return {
      totalBTCStaked: maxDecimals(satoshiToBtc(statsData.btcStaked || 0), 4),
      totalTVL: statsData.tvl || 0,
      totalAtBtcMinted: maxDecimals(
        satoshiToBtc(statsData.atbtcMinted || 0),
        4,
      ),
    };
  }, [stats.data]);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <CardStat
        icon={<StakeIcon />}
        title="Total BTC Staked"
        value={statsValue?.totalBTCStaked.toString() ?? "--"}
        valueUnit={BTC_TOKEN}
      />
      <CardStat
        icon={<LockIcon />}
        title="Total TVL"
        value={
          statsValue?.totalTVL
            ? Number(statsValue.totalTVL.toFixed(2)).toLocaleString()
            : "--"
        }
        valueUnit={"USD"}
      />
      <CardStat
        icon={<AtBTCIcon size={30} />}
        title={`${ATLAS_BTC_TOKEN} Minted`}
        value={statsValue?.totalAtBtcMinted.toString() ?? "--"}
        valueUnit={ATLAS_BTC_TOKEN}
      />
    </div>
  );
};

function AtBTCIcon({ size }: { size: number }) {
  return (
    <Image src={atbtcImage} alt="Atlas Protocol" width={size} height={size} />
  );
}
