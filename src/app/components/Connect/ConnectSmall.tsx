import { useRef, useState } from "react";
import { FaBitcoin } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { LuWallet } from "react-icons/lu";
import { useOnClickOutside } from "usehooks-ts";

import { getNetworkConfig } from "@/config/network.config";
import { satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";
import { trim } from "@/utils/trim";

import { Button } from "../Button";
import { Hash } from "../Hash/Hash";

interface ConnectSmallProps {
  onConnect: () => void;
  address: string;
  balanceSat: number;
  onDisconnect: () => void;
}

export const ConnectSmall: React.FC<ConnectSmallProps> = ({
  onConnect,
  address,
  balanceSat,
  onDisconnect,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const handleClickOutside = () => {
    setShowMenu(false);
  };

  const ref = useRef(null);
  useOnClickOutside(ref, handleClickOutside);

  const { coinName, networkName } = getNetworkConfig();

  return address ? (
    <div className="relative mr-[-10px] flex text-sm" ref={ref}>
      <button
        className="h-10 p-1 rounded-full border border-neutral-5 dark:border-neutral-10 justify-start items-center gap-2 inline-flex px-1"
        onClick={() => setShowMenu(!showMenu)}
      >
        <div className="flex items-center gap-1">
          <FaBitcoin size={20} className="text-[#F6AB13]" />
          <strong className="text-lg font-bold">
            {maxDecimals(satoshiToBtc(balanceSat), 8) || 0} {coinName}
          </strong>
        </div>
        <div className="h-8 px-4 py-1 rounded-[40px] border border-primary justify-center items-center inline-flex text-primary">
          {trim(address)}
        </div>
      </button>
      {showMenu && (
        <div
          className="absolute right-[10px] top-0 z-10 mt-10 flex flex-col gap-4 rounded-lg bg-card-bg p-4 shadow-lg"
          style={{
            width: "calc(100% - 8px)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold dark:text-neutral-content">Settings</h3>
            <button
              className="btn btn-circle btn-ghost btn-sm"
              onClick={() => setShowMenu(false)}
            >
              <IoMdClose size={24} />
            </button>
          </div>
          <div className="flex flex-col">
            <Hash value={address} address noFade fullWidth />
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setShowMenu(false);
              onDisconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  ) : (
    <Button onClick={onConnect} disabled={!!address} startIcon={<LuWallet />}>
      Connect to {networkName} network
    </Button>
  );
};
