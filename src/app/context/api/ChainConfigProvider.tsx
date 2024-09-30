import { createContext, useContext, useState, useEffect } from "react";

import { getChainConfigs } from "@/app/api/getChainConfigs"; // API function to fetch chain configs
import { ChainConfig } from "@/app/types/chainConfig";

interface ChainConfigContextProps {
  chainConfigs: Record<string, ChainConfig> | null;
  loading: boolean;
  error: string | null;
}

const ChainConfigContext = createContext<ChainConfigContextProps | undefined>(
  undefined
);

export const ChainConfigProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [chainConfigs, setChainConfigs] = useState<Record<string, ChainConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const configs = await getChainConfigs();
        setChainConfigs(configs);
      } catch (error) {
        setError("Failed to load chain configurations");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadConfigs();
  }, []);

  return (
    <ChainConfigContext.Provider value={{ chainConfigs, loading, error }}>
      {children}
    </ChainConfigContext.Provider>
  );
};

export const useChainConfig = (): ChainConfigContextProps => {
  const context = useContext(ChainConfigContext);
  if (!context) {
    throw new Error("useChainConfig must be used within a ChainConfigProvider");
  }
  return context;
};
