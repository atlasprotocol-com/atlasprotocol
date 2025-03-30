import { useQuery } from "@tanstack/react-query";

import { getGlobalParams } from "@/app/api/getGlobalParams";
import { getStats } from "@/app/api/getStats";

export function useGetGlobalParams() {
  return useQuery({
    queryKey: ["global-params"],
    queryFn: async () => {
      const data = await getGlobalParams();
      return data[0];
    },
    refetchInterval: 60000,
    retry: 5,
  });
}

export function useGetStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => getStats(),
    refetchInterval: 60000,
    retry: 5,
  });
}
