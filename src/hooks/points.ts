import { useQuery } from "@tanstack/react-query";

import { getUserPoints, getUserPointsLeaderBoard } from "@/app/api/points";

export function useGetUserPoints({ address }: { address?: string }) {
  return useQuery({
    queryKey: ["user-points", address],
    queryFn: async () => {
      const result = await getUserPoints({ address: address || "" });
      return result;
    },
    enabled: !!address,
  });
}

export function useGetUserPointsLeaderBoard() {
  return useQuery({
    queryKey: ["user-points-leaderboard"],
    queryFn: async () => {
      const result = await getUserPointsLeaderBoard();
      return result;
    },
  });
}
