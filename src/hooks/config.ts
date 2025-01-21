import { useQuery } from "@tanstack/react-query";

import { getChainConfigs } from "@/app/api/getChainConfigs";

export function useGetChainConfig() {
  return useQuery({
    queryKey: ["config", "chain"],
    queryFn: async () => {
      const configs = await getChainConfigs();
      return configs;
    },
  });
}
