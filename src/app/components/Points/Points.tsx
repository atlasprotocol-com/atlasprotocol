import { useContext, useState } from "react";
import { useDisconnect, useSwitchChain } from "wagmi";

import { ChainConfig } from "@/app/types/chainConfig";
import { useGetUserPoints, useGetUserPointsLeaderBoard } from "@/hooks/points";
import { NearContext } from "@/utils/near";

import { RequireConnectWallet } from "../RequireConnectWallet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../Table";

const currentUser = {
  name: "John Doe",
  basePoints: 1000,
  burrowMultiplier: 1.5,
  refMultiplier: 1.2,
};

export function Points() {
  const { signedAccountId: nearAccountId, wallet: nearWallet } =
    useContext(NearContext);

  const { switchChainAsync } = useSwitchChain();
  const { disconnectAsync, isPending: isDisconnecting } = useDisconnect();

  const [selectedFromChain, setSelectedChain] = useState<
    ChainConfig | undefined
  >(undefined);

  const userPoints = useGetUserPoints({
    address: nearAccountId,
    //address: "buglungtung.testnet",
  });

  const leaderBoard = useGetUserPointsLeaderBoard();

  const handleDisconnect = async () => {
    await nearWallet?.signOut();
  };

  return (
    <>
      <RequireConnectWallet
        required={!Boolean(nearAccountId)}
        onConnect={() => {
          nearWallet?.signIn();
        }}
        description="Please connect NEAR wallet to view your points"
        renderContent={
          <>
            <div className="card p-4 bg-base-300">
              <div className="flex items-center justify-between">
                <div className={`mt-2 lex items-center`}>
                  Your address: {nearAccountId}
                </div>
                <button
                  className="ml-auto"
                  onClick={() => {
                    handleDisconnect();
                  }}
                  disabled={isDisconnecting}
                >
                  Disconnect
                </button>
              </div>
            </div>
            {selectedFromChain?.networkType === "EVM" && (
              <div className="mt-6 card bg-base-300 p-4 shadow-sm relative">
                <h3 className="mb-4 font-bold text-lg">My points</h3>
                <p className="text-center">Under construction</p>
              </div>
            )}
            {userPoints.data === null && (
              <div className="mt-6 card bg-base-300 p-4 shadow-sm relative">
                <h3 className="mb-4 font-bold text-lg">My points</h3>
                <p className="text-center">No data found</p>
              </div>
            )}

            {userPoints.data && (
              <div className="mt-2 card flex flex-col gap-2 bg-base-300 p-4 shadow-sm lg:flex-1 relative">
                <h3 className="mb-4 font-bold text-lg">My points</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>Base Points:</div>
                  <div className="font-semibold">
                    {userPoints.data.point_total}
                  </div>
                  <div>Burrow Multiplier:</div>
                  <div className="font-semibold">
                    x{userPoints.data.multiplier.burrow}
                  </div>
                  <div>Ref Multiplier:</div>
                  <div className="font-semibold">
                    {" "}
                    x{userPoints.data.multiplier.reffinance}
                  </div>
                  <div className="font-semibold">Total Points:</div>
                  <div className=" font-bold">
                    {userPoints.data.point_total_after_multiplier}
                  </div>
                </div>
              </div>
            )}

            {leaderBoard.data && (
              <div className="mt-6 card bg-base-300 p-4 shadow-sm relative">
                <h3 className="mb-4 font-bold text-lg">Leader board</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Rank</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Total Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderBoard.data.map((user, index) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>{user.user_address}</TableCell>
                        <TableCell className="text-right">
                          {user.point_total_after_multiplier}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        }
      />
    </>
  );
}
