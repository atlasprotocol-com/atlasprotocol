import { useMemo } from "react";

import { useConnectMultiChain } from "@/app/hooks/useConnectMultiChain";
import { ChainConfig } from "@/app/types/chainConfig";
import { useGetChainConfig } from "@/hooks";
import { useGetUserPoints } from "@/hooks/points";

import { RequireConnectWallet } from "../RequireConnectWallet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../Table";

export function Points() {
  const { data: chainConfigs = {} } = useGetChainConfig();

  const selectedChain = useMemo(() => {
    return Object.values(chainConfigs || {}).find(
      (chainConfig) => chainConfig.networkType === "NEAR",
    ) as ChainConfig | undefined;
  }, [chainConfigs]);

  const {
    address: fromAddress,
    connect,
    disconnectAsync,
  } = useConnectMultiChain({
    selectedChain,
    lazyConnect: true,
  });
  const handleConnectModal = () => {
    connect();
  };

  const { data, isLoading } = useGetUserPoints({
    address: fromAddress || undefined,
  });

  const points = data || {};
  const addresses = Object.keys(points).toSorted((a, b) => {
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
  });

  return (
    <RequireConnectWallet
      required={!fromAddress}
      onConnect={handleConnectModal}
      description="Please connect your NEAR wallet to check your points."
      renderContent={
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="mt-2 flex items-center gap-2">
            <p className="text-[13px] text-caption">
              Near address: <strong>{fromAddress}</strong>
            </p>
            <button
              className="font-semibold text-primary text-[13px]"
              onClick={() => disconnectAsync()}
            >
              Disconnect
            </button>
          </div>
          {!isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">No.</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Total Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addresses.map((address, index) => (
                  <TableRow key={address}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{address}</TableCell>
                    <TableCell className="text-right">
                      {points[address]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      }
    />
  );
}
