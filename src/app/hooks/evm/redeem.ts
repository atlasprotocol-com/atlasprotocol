import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { AbiItem } from "web3";

import aBTCABI from "@/utils/ABI/aBTC.json";

import { useWeb3jsSigner } from "./web3";

export function useEVMAbtcBurnRedeem() {
  const { chainId } = useAccount();

  const w3 = useWeb3jsSigner({
    chainId: chainId,
  });

  return useMutation({
    mutationFn: async ({
      amount,
      btcAddress,
      from,
      estimatedGas,
      gasPrice,
      contractAddress,
    }: {
      amount: number;
      btcAddress: string;
      from: string;
      estimatedGas?: number;
      gasPrice?: number;
      contractAddress: string;
    }) => {
      const contract = new w3.eth.Contract(
        aBTCABI as AbiItem[],
        contractAddress,
      );

      const r = await contract.methods.burnRedeem(amount, btcAddress).send({
        from: from,
        gas: estimatedGas?.toString(),
        gasPrice: gasPrice?.toString(),
      });

      return r;
    },
  });
}
