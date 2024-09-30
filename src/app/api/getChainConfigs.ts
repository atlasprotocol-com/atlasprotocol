import { ChainConfig } from "../types/chainConfig";

import { apiWrapper } from "./apiWrapper";

// Define the structure of the API response
interface ChainConfigResponse {
  data: Record<string, ChainConfig>;
}

// Fetch all chain configurations from the backend
export const getChainConfigs = async (): Promise<Record<string, ChainConfig>> => {
  try {
    // Make the API call to fetch chain configs
    const response = await apiWrapper("GET", "/api/v1/chainConfigs", "Error fetching chain configs");

    // Extract the chain configs from the response
    const chainConfigResponse: ChainConfigResponse = response.data;
    
    // Return the chain configs (as an object with keys being the chain IDs)
    return chainConfigResponse.data;
  } catch (error) {
    console.error("Error fetching chain configs:", error);
    throw new Error("Failed to fetch chain configs");
  }
};
