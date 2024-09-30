import { useQuery } from "@tanstack/react-query";
import React, { ReactNode, createContext, useContext, useEffect } from "react";

import { getGlobalParams } from "@/app/api/getGlobalParams";
import { GlobalParamsVersion } from "@/app/types/globalParams";
import { ErrorState } from "@/app/types/errors";

import { useError } from "../Error/ErrorContext";

interface GlobalParamsProviderProps {
  children: ReactNode;
}

interface GlobalParamsContextType {
  data: GlobalParamsVersion[] | undefined;
  isLoading: boolean;
}

const defaultContextValue: GlobalParamsContextType = {
  data: undefined,
  isLoading: true,
};

const GlobalParamsContext = createContext<GlobalParamsContextType>(defaultContextValue);

export const GlobalParamsProvider: React.FC<GlobalParamsProviderProps> = ({ children }) => {
  const { isErrorOpen, showError } = useError();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["API_GLOBAL_PARAMS"],
    queryFn: async () => getGlobalParams(),
    refetchInterval: 60000, // 1 minute
    retry: (failureCount) => {
      return !isErrorOpen && failureCount <= 3;
    },
  });

  useEffect(() => {
    if (isError && error) {
      showError({
        error: {
          message: error.message,
          errorState: ErrorState.SERVER_ERROR,
          errorTime: new Date(),
        },
        retryAction: refetch,
      });
    }
  }, [isError, error, showError, refetch]);

  return (
    <GlobalParamsContext.Provider value={{ data, isLoading }}>
      {children}
    </GlobalParamsContext.Provider>
  );
};

// Custom hook to use the global params
export const useGlobalParams = () => useContext(GlobalParamsContext);
