import Web3 from "web3";
import { AbiItem } from "web3-utils";

import { btcToSatoshi } from "@/utils/btcConversions";
import aBTCABI from "@/utils/ABI/aBTC.json";
import { getStats } from "@/app/api/getStats";
import { NEAR_GAS } from "@/app/types/nearGas";

interface GasEstimateResult {
  gasEstimate: number;
  gasPrice: number;
  mintingFeeSat: number;
  success: boolean;
}

export const getEstimateAbtcMintGas = async (
  chainRpcUrl: string,
  contractAddress: string,
  userAddress: string,
  amount: number,
  btcTxnHash: string,
  contractOwner: string,
  networkType: string,
  toSymbol: string,
): Promise<GasEstimateResult> => {
  try {
    let gasEstimate = 0;
    let gasPrice = 0;
    let mintingFeeBtc = 0;
    
    const stats = await getStats();
    const ethPriceBtc = stats?.ethPriceBtc || 0;
    const nearPriceBtc = stats?.nearPriceBtc || 0;
    const btcPriceUsd = stats?.btcPriceUsd || 0;
    const polPriceUsd = stats?.polPriceUsd || 0;
    const polPriceBtc = btcPriceUsd > 0 ? polPriceUsd / btcPriceUsd : 0;

    if (networkType === "EVM") {
      const web3 = new Web3(chainRpcUrl);
      const contract = new web3.eth.Contract(
        aBTCABI as AbiItem[],
        contractAddress,
      );

      const data = contract.methods
        .mintDeposit(userAddress, 0, btcTxnHash)
        .encodeABI();

      const gasPriceBigInt = await web3.eth.getGasPrice();
      gasPrice = Number(gasPriceBigInt) * 1.3;

      const gasEstimateBigInt = await web3.eth.estimateGas({
        to: contractAddress,
        from: contractOwner,
        data: data,
      });
      gasEstimate = Number(gasEstimateBigInt) * 1.3;

      const mintingFeeEth = (gasEstimate * gasPrice) / 1e18;
    
      if (toSymbol === "POL") {
        mintingFeeBtc = mintingFeeEth * polPriceBtc;
      } else if (toSymbol === "ETH") {
        mintingFeeBtc = mintingFeeEth * ethPriceBtc;
      } else {
        // Default to ETH price for now
        mintingFeeBtc = mintingFeeEth * ethPriceBtc;
      }

      console.log("EVM - mintingFeeBtc:", mintingFeeBtc);

    } else if (networkType === "NEAR") {
      const gasEstimateTgas = Number(NEAR_GAS.GAS_FOR_MINT_CALL);  // 100 Tgas
      const gasPriceYocto = 100_000_000;  // 100 million yoctoNEAR per gas unit
  
      // Convert Tgas to gas units and calculate minting fee
      const gasEstimate = gasEstimateTgas * 1e12;  
      const mintingFeeYocto = gasEstimate * gasPriceYocto;
  
      // Convert yoctoNEAR to NEAR (1 NEAR = 10^18 yoctoNEAR)
      const mintingFeeNear = mintingFeeYocto / 1e24;
  
      // Convert NEAR to BTC using NEAR price in BTC
      mintingFeeBtc = mintingFeeNear * nearPriceBtc;

      console.log("NEAR - mintingFeeBtc:", mintingFeeBtc);

    }

    return {
      gasEstimate,
      gasPrice,
      mintingFeeSat: Math.max(Number(process.env.NEXT_PUBLIC_DUST_LIMIT), btcToSatoshi(mintingFeeBtc)),
      success: true,
    };
  } catch (error) {
    console.error("Failed to estimate gas:", error);
    return {
      gasEstimate: 0,
      gasPrice: 0,
      mintingFeeSat: 0,
      success: false,
    };
  }
};
