import { address, networks } from "bitcoinjs-lib";
import { isAddress } from "viem";
import Web3 from "web3";

import { network } from "@/config/network.config";

import { Network } from "./wallet/wallet_provider";
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
  networkType: "EVM" | "NEAR";
  address: string;
}): boolean {
  switch (networkType) {
    case "EVM":
      return isAddress(address);
    case "NEAR":
      console.log(
        "NEAR_ACCOUNT_ID_REGEX.test(address)",
        NEAR_ACCOUNT_ID_REGEX.test(address),
      );
      return NEAR_ACCOUNT_ID_REGEX.test(address);
    default:
      throw new Error(`Unsupported network type: ${networkType}`);
  }
}

export function validateBTCAddress(addressInput: string): boolean {
  try {
    // Basic BTC address format validation
    const mainnetRegex = /^(bc1)[a-zA-HJ-NP-Z0-9]{39,59}$/;
    const testnetRegex = /^(tb1)[a-zA-HJ-NP-Z0-9]{39,59}$/;

    // Validate address format based on network
    if (network === Network.MAINNET) {
      if (!mainnetRegex.test(addressInput)) {
        return false;
      }
    } else {
      if (!testnetRegex.test(addressInput)) {
        return false;
      }
    }

    // Additional validation - check if address has valid checksum
    // by attempting to decode it
    try {
      address.fromBech32(addressInput);
      return true;
    } catch {
      return false;
    }

  } catch (error) {
    console.error("Error in validateBTCAddress", error);
    return false;
  }
}
