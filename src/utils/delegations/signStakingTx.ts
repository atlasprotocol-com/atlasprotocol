import { Transaction, networks } from "bitcoinjs-lib";

import { signPsbtTransaction } from "@/app/common/utils/psbt";
import { isTaproot } from "@/utils/wallet";
import { UTXO, WalletProvider } from "@/utils/wallet/wallet_provider";

import { stakingTransaction } from "../btcStaking";

// Returns:
// - unsignedStakingPsbt: the unsigned staking transaction
// - stakingTerm: the staking term
// - stakingFee: the staking fee
export const createStakingTx = (
  stakingAmountSat: number,
  finalityProviderPublicKey: string,
  btcWalletNetwork: networks.Network,
  address: string,
  publicKeyNoCoord: string,
  feeRate: number,
  inputUTXOs: UTXO[],
  protocolFeeSat: number,
  mintingFeeSat: number,
  treasuryAddress: string,
  receivingChainID: string,
  receivingAddress: string,
) => {
  if (inputUTXOs.length == 0) {
    throw new Error("Not enough usable balance");
  }

  if (feeRate <= 0) {
    throw new Error("Invalid fee rate");
  }

  // Create the staking transaction
  let unsignedStakingPsbt;
  let stakingFeeSat;
  let yieldProviderGasFeeSat;
  try {
    const { psbt, fee, yieldProviderGasFee } = stakingTransaction(
      address,
      finalityProviderPublicKey,
      stakingAmountSat,
      feeRate, 
      inputUTXOs,
      btcWalletNetwork,
      protocolFeeSat,
      mintingFeeSat,
      treasuryAddress,
      receivingChainID,
      receivingAddress,
      isTaproot(address) ? Buffer.from(publicKeyNoCoord, "hex") : undefined,
    );
    unsignedStakingPsbt = psbt;
    stakingFeeSat = fee;
    yieldProviderGasFeeSat = yieldProviderGasFee;
  } catch (error: Error | any) {
    throw new Error(
      error?.message || "Cannot build unsigned staking transaction",
    );
  }

  return { unsignedStakingPsbt, stakingFeeSat, yieldProviderGasFeeSat };
};

// Sign a staking transaction
// Returns:
// - stakingTxHex: the signed staking transaction
// - stakingTerm: the staking term
export const signStakingTx = async (
  btcWallet: WalletProvider,
  stakingAmountSat: number,
  finalityProviderPublicKey: string,
  btcWalletNetwork: networks.Network,
  address: string,
  publicKeyNoCoord: string,
  feeRate: number,
  inputUTXOs: UTXO[],
  protocolFeeSat: number,
  mintingFeeSat: number,
  treasuryAddress: string,
  receivingChainID: string,
  receivingAddress: string,
): Promise<{ stakingTxHex: string; txHash: string }> => {
  
  // Create the staking transaction
  let { unsignedStakingPsbt } = createStakingTx(
    stakingAmountSat,
    finalityProviderPublicKey,
    btcWalletNetwork,
    address,
    publicKeyNoCoord,
    feeRate,
    inputUTXOs,
    protocolFeeSat,
    mintingFeeSat,
    treasuryAddress,
    receivingChainID,
    receivingAddress,
  );

  // Sign the staking transaction
  let stakingTx: Transaction;
  try {
    stakingTx = await signPsbtTransaction(btcWallet)(
      unsignedStakingPsbt.toHex(),
    );
    
  } catch (error: Error | any) {
    throw new Error(error?.message || "Staking transaction signing PSBT error");
  }

  // Get the staking transaction hex
  const stakingTxHex = stakingTx.toHex();

  // Broadcast the staking transaction
  const txHash = await btcWallet.pushTx(stakingTxHex);

  return { stakingTxHex, txHash };
};
