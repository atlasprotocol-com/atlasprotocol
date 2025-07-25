import { useQuery } from "@tanstack/react-query";

import { getUserPoints, getUserPointsLeaderboard } from "@/app/api/points";

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

export function useGetUserPointsLeaderboard(limit: number = 10) {
  return useQuery({
    queryKey: ["user-points-leaderboard", limit],
    queryFn: async () => {
      const result = await getUserPointsLeaderboard({ limit });
      return result;
    },
    enabled: limit > 0,
  });
}
