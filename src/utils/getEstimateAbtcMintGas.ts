import Web3 from "web3";
import { AbiItem } from "web3-utils";

import aBTCABI from "@/utils/ABI/aBTC.json";

interface GasEstimateResult {
  gasEstimate: number;
  gasPrice: number;
  success: boolean;
}

export const getEstimateAbtcMintGas = async (
  chainRpcUrl: string,
  contractAddress: string,
  userAddress: string,
  amount: number,
  btcTxnHash: string,
  contractOwner: string,
): Promise<GasEstimateResult> => {

  try {
    const web3 = new Web3(chainRpcUrl);
    const contract = new web3.eth.Contract(
      aBTCABI as AbiItem[],
      contractAddress,
    );

    const data = contract.methods.mintDeposit(userAddress, 0, btcTxnHash).encodeABI();

    const gasPriceBigInt = await web3.eth.getGasPrice();
    const gasPrice = Number(gasPriceBigInt) * 1.1;

    const gasEstimateBigInt = await web3.eth.estimateGas({
      to: contractAddress,
      from: contractOwner,
      data: data,
    });
    const gasEstimate = Number(gasEstimateBigInt) * 1.1;

    return {
      gasEstimate,
      gasPrice,
      success: true,
    };
  } catch (error) {
    console.error("Failed to estimate gas:", error);
    return {
      gasEstimate: 0,
      gasPrice: 0,
      success: false,
    };
  }
};
