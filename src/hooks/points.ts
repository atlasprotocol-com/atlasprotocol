import { useQuery } from "@tanstack/react-query";

import { getUserPoints } from "@/app/api/points";

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
