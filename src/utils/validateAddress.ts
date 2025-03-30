import { isAddress } from "viem";
import Web3 from "web3";

// Function to validate an address based on the network type
export const isValidAddress = (
  networkType: string,
  address: string,
): boolean => {
  // If the network type is EVM, validate using Web3's address validation
  if (networkType === "EVM") {
    return Web3.utils.isAddress(address);
  } else if (networkType === "NEAR") {
    return true;
  }
  // For other networks (you can add more cases here for non-EVM networks)
  // For now, just return false for unsupported network types
  return false;
};

const NEAR_ACCOUNT_ID_REGEX = /^[^\s.]+(?:\.[^\s.]+)*\.(?:testnet|near)$/;

export function validateBlockchainAddress({
  networkType,
  address,
}: {
  networkType: "EVM" | "NEAR" | string;
  address: string;
}): boolean {
  switch (networkType) {
    case "EVM":
      return isAddress(address);
    case "NEAR":
      return NEAR_ACCOUNT_ID_REGEX.test(address);
    default:
      return false;
  }
}
