import Web3 from "web3";
import { AbiItem } from "web3-utils";

const ERC20_ABI: AbiItem[] = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
];

interface BalanceResult {
  abtcBalance: number;
  success: boolean;
}

export const getAbtcBalance = async (chainRpcUrl: string, tokenAddress: string, userAddress: string): Promise<number> => {
  try {
    const web3 = new Web3(chainRpcUrl);
    const contract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
    const balance: string = await contract.methods.balanceOf(userAddress).call();
    const abtcBalance = parseInt(balance.toString()); // Convert from Wei to Ether and parse as number
    return abtcBalance;
  } catch (error) {
    console.error("Failed to fetch aBTC balance:", error);
    return -1;
  }
};
