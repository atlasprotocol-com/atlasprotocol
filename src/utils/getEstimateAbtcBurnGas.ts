import Web3 from "web3";
import { AbiItem } from "web3-utils";

import aBTCABI from "@/utils/ABI/aBTC.json";

interface GasEstimateResult {
  gasEstimate: number;
  gasPrice: number;
  success: boolean;
}

export const getEstimateAbtcBurnGas = async (
  chainRpcUrl: string,
  contractAddress: string,
  userAddress: string,
  amount: number,
  btcAddress: string,
): Promise<GasEstimateResult> => {
  try {
    const web3 = new Web3(chainRpcUrl);
    const contract = new web3.eth.Contract(
      aBTCABI as AbiItem[],
      contractAddress,
    );
    // Note: The amount is hardcoded to 0 in the snippet below. If > 0 error will be thrown
    const data = contract.methods.burnRedeem(0, btcAddress).encodeABI();
    // const data = contract.methods.burnRedeem(amount, btcAddress).encodeABI();

    const gasPriceBigInt = await web3.eth.getGasPrice();
    const gasPrice = Number(gasPriceBigInt);

    const gasEstimateBigInt = await web3.eth.estimateGas({
      to: contractAddress,
      from: userAddress,
      data: data,
    });
    const gasEstimate = Number(gasEstimateBigInt);

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
