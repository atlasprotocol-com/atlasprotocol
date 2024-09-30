import Web3 from "web3";

// Function to validate an address based on the network type
export const isValidAddress = (networkType: string, address: string): boolean => {
  // If the network type is EVM, validate using Web3's address validation
  if (networkType === "EVM") {
    return Web3.utils.isAddress(address);
  }else if (networkType === "NEAR") {
    return true;
  }
  // For other networks (you can add more cases here for non-EVM networks)
  // For now, just return false for unsupported network types
  return false;
};
