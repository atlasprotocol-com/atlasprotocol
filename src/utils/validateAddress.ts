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
    // Convert address to output script
    const outputScript = address.toOutputScript(
      addressInput,
      network === Network.SIGNET || network === Network.TESTNET4 ? networks.testnet : networks.bitcoin
    );

    // Get address type from first byte of output script
    const firstByte = outputScript[0];

    // Check if segwit (starts with 0x00 or 0x01) or taproot (starts with 0x51)
    if (firstByte === 0x00 || firstByte === 0x01 || firstByte === 0x51) {
      return true;
    }

    return false;

  } catch (error) {
    return false;
  }
}
