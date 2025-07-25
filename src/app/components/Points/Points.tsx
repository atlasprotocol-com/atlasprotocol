import { useMemo } from "react";

import { useConnectMultiChain } from "@/app/hooks/useConnectMultiChain";
import { ChainConfig } from "@/app/types/chainConfig";
import { useGetChainConfig } from "@/hooks";
import { useGetUserPoints, useGetUserPointsLeaderboard } from "@/hooks/points";

import { useBool } from "@/hooks/useBool";
import { ConnectEvmWalletModal } from "../Modals/ConnectEvmWalletModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../Table";

export function Points() {
  const evmWalletModal = useBool();
  const { data: chainConfigs = {} } = useGetChainConfig();

  const nearChain = useMemo(() => {
    return Object.values(chainConfigs || {}).find(
      (chainConfig) => chainConfig.networkType === "NEAR",
    ) as ChainConfig | undefined;
  }, [chainConfigs]);
  const {
    address: nearWallet,
    connect: connectNearWallet,
    disconnectAsync: disconnectNearWallet,
  } = useConnectMultiChain({
    selectedChain: nearChain,
    lazyConnect: true,
  });

  const evmChain = useMemo(() => {
    return Object.values(chainConfigs || {}).find(
      (chainConfig) => chainConfig.networkType === "EVM",
    ) as ChainConfig | undefined;
  }, [chainConfigs]);
  const {
    address: evmWallet,
    connect: connectEvmWallet,
    disconnectAsync: disconnectEvmWallet,
  } = useConnectMultiChain({
    selectedChain: evmChain,
    lazyConnect: true,
    onRequireEvmWallet: () => {
      evmWalletModal.setTrue();
    },
  });

  const { data: leaderboardData, isLoading: leaderboardLoading } =
    useGetUserPointsLeaderboard();
  const leaderboard = leaderboardData || [];

  const { data: userPointsData, isLoading: userPointsLoading } =
    useGetUserPoints({
      address: [nearWallet, evmWallet]
        .filter(Boolean)
        .map((s) => s?.toLowerCase())
        .join(","),
    });
  const userPoints = userPointsData || {};

  return (
    <>
      <ConnectEvmWalletModal
        isOpen={evmWalletModal.value}
        onClose={evmWalletModal.setFalse}
        selectedChain={evmChain?.networkName || null}
        selectedChainID={evmChain?.chainID || null}
      />
      <div className="flex flex-col w-full max-w-4xl mx-auto p-4 gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="font-medium mb-3">NEAR Wallet</h3>
            {!nearWallet ? (
              <button
                disabled={userPointsLoading}
                onClick={() => connectNearWallet()}
                className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
              >
                {userPointsLoading
                  ? "Connecting NEAR Wallet..."
                  : "Connect NEAR Wallet"}
              </button>
            ) : (
              <div className="space-y-1">
                <p
                  className="text-sm text-foreground truncate max-w-full"
                  title={nearWallet}
                >
                  {nearWallet}
                </p>
                <p className="text-sm">
                  <strong>{userPoints[nearWallet] || 0} points</strong>
                </p>
                <button
                  onClick={() => disconnectNearWallet()}
                  className="text-sm text-primary hover:underline"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="font-medium mb-3">EVM Wallet</h3>
            {!evmWallet ? (
              <button
                disabled={userPointsLoading}
                onClick={() => connectEvmWallet()}
                className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
              >
                {userPointsLoading
                  ? "Connecting EVM Wallet..."
                  : "Connect EVM Wallet"}
              </button>
            ) : (
              <div className="space-y-1">
                <p
                  className="text-sm text-foreground truncate max-w-full"
                  title={evmWallet}
                >
                  {evmWallet}
                </p>
                <p className="text-sm">
                  <strong>
                    {userPoints[evmWallet.toLowerCase()] || 0} points
                  </strong>
                </p>
                <button
                  onClick={() => disconnectEvmWallet()}
                  className="text-sm text-primary hover:underline"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="w-full">
          <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
          {leaderboardLoading ? (
            <div className="flex justify-center items-center h-32">
              <p>Loading leaderboard data...</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[80px]">Rank</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Total Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard?.length > 0 ? (
                    leaderboard.map((item, index) => (
                      <TableRow
                        key={item.wallet_address}
                        className="hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">
                          #{index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.wallet_address}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.points.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
