// src/config/network.chain.config.ts
import { getChainConfigs } from "@/app/api/getChainConfigs";
import { ChainConfig } from "@/app/types/chainConfig";

// Variable to hold the loaded configuration data
let chainConfigs: Record<string, ChainConfig> = {};

// Load the chain configs asynchronously
export const loadChainConfigs = async (): Promise<void> => {
  try {
    chainConfigs = await getChainConfigs();
  } catch (error) {
    console.error("Error loading chain configs:", error);
    throw new Error("Failed to load chain configs.");
  }
};

// Function to get a specific chain config by ID
export const getChainConfig = (chainID: string): ChainConfig | undefined => {
  return chainConfigs[chainID];
};

// Function to get all chain configs
export const getAllChainConfigs = (): Record<string, ChainConfig> => {
  return chainConfigs;
};
