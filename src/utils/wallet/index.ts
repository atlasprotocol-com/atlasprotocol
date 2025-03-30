import { networks } from "bitcoinjs-lib";

import { Network } from "./wallet_provider";

const nativeSegwitAddressLength = 42;
const taprootAddressLength = 62;

export const toNetwork = (network: string): networks.Network => {
  console.log("network", network);
  switch (network) {
    case Network.MAINNET:
      return networks.bitcoin;
    case Network.TESTNET:
    case Network.TESTNET4:
    case Network.SIGNET:
    case "unknown":
      return networks.testnet;
    default:
      throw new Error("Unsupported network");
  }
};

export const isSupportedAddressType = (address: string): boolean => {
  return (
    address.length === nativeSegwitAddressLength ||
    address.length === taprootAddressLength
  );
};

export const isTaproot = (address: string): boolean => {
  return address.length === taprootAddressLength;
};

export const getPublicKeyNoCoord = (pkHex: string): Buffer => {
  const publicKey = Buffer.from(pkHex, "hex");
  return publicKey.subarray(1, 33);
};
