import Web3 from "web3";
import { AbiItem } from "web3-utils";

import aBTCABI from "@/utils/ABI/aBTC.json";
import { NEAR_GAS } from "@/app/types/nearGas";

interface GasEstimateResult {
  gasEstimate: number;
  gasPrice: number;
  gasLimit: number;
  success: boolean;
}

export const getEstimateAbtcBurnGas = async (
  chainRpcUrl: string,
  contractAddress: string,
  userAddress: string,
  amount: number,
  btcAddress: string,
  networkType: string,
): Promise<GasEstimateResult> => {
  try {
    let gasEstimate = 0;
    let gasPrice = 0;
    let gasLimit = 0;

    if (networkType === "EVM") {
      const web3 = new Web3(chainRpcUrl);
      const contract = new web3.eth.Contract(
        aBTCABI as AbiItem[],
        contractAddress,
      );
      // Note: The amount is hardcoded to 0 in the snippet below. If > 0 error will be thrown
      const data = contract.methods.burnRedeem(0, btcAddress).encodeABI();
      // const data = contract.methods.burnRedeem(amount, btcAddress).encodeABI();

      const gasPriceBigInt = await web3.eth.getGasPrice();
      gasPrice = Number(gasPriceBigInt) * 1.3;

      const gasEstimateBigInt = await web3.eth.estimateGas({
        to: contractAddress,
        from: userAddress,
        data: data,
      });
      gasEstimate = Number(gasEstimateBigInt) * 1.3;
      gasLimit = (gasPrice * gasEstimate) / 10 ** 18

      console.log("EVM - gasLimit:", gasLimit);
    } else if (networkType === "NEAR") {
      const gasEstimateTgas = Number(NEAR_GAS.SIGN_GAS); // 100 Tgas
      const gasPriceYocto = 100_000_000; // 100 million yoctoNEAR per gas unit

      // Convert Tgas to gas units and calculate burn fee
      gasEstimate = gasEstimateTgas * 1e12;

      const burningFeeYocto = gasEstimate * gasPriceYocto;
  
      // Convert yoctoNEAR to NEAR (1 NEAR = 10^18 yoctoNEAR)
      gasLimit = burningFeeYocto / 1e24;
      
      console.log("NEAR - gasLimit:", gasLimit);
    }
    return {
      gasEstimate: Math.ceil(gasEstimate),
      gasPrice: Math.ceil(gasPrice),
      gasLimit: gasLimit,
      success: true,
    };
  } catch (error) {
    console.error("Failed to estimate gas:", error);
    return {
      gasEstimate: 0,
      gasPrice: 0,
      gasLimit: 0,
      success: false,
    };
  }
};
