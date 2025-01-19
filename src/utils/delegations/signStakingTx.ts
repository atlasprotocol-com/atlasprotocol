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
  data: string,
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
  try {
    const { psbt, fee } = stakingTransaction(
      address,
      finalityProviderPublicKey,
      stakingAmountSat,
      feeRate + 1, // + 1 to avoid bad fee estimation
      inputUTXOs,
      btcWalletNetwork,
      data,
      isTaproot(address) ? Buffer.from(publicKeyNoCoord, "hex") : undefined,
    );
    unsignedStakingPsbt = psbt;
    stakingFeeSat = fee;
  } catch (error: Error | any) {
    throw new Error(
      error?.message || "Cannot build unsigned staking transaction",
    );
  }

  return { unsignedStakingPsbt, stakingFeeSat };
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
  data: string,
): Promise<{ stakingTxHex: string; txHash: string }> => {
  console.log("Signing staking transaction", {
    stakingAmountSat,
    finalityProviderPublicKey,
    btcWalletNetwork,
    address,
    publicKeyNoCoord,
    feeRate,
    inputUTXOs,
    data,
  });

  // Create the staking transaction
  let { unsignedStakingPsbt } = createStakingTx(
    stakingAmountSat,
    finalityProviderPublicKey,
    btcWalletNetwork,
    address,
    publicKeyNoCoord,
    feeRate,
    inputUTXOs,
    data,
  );

  // Sign the staking transaction
  let stakingTx: Transaction;
  try {
    stakingTx = await signPsbtTransaction(btcWallet)(
      unsignedStakingPsbt.toHex(),
    );
  } catch (error: Error | any) {
    console.error("Staking transaction signing PSBT error", error);
    throw new Error(error?.message || "Staking transaction signing PSBT error");
  }

  // Get the staking transaction hex
  const stakingTxHex = stakingTx.toHex();

  // Broadcast the staking transaction
  const txHash = await btcWallet.pushTx(stakingTxHex);

  return { stakingTxHex, txHash };
};
