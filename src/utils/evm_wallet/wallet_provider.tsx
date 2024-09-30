import {
  FC,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { useAccount, useSwitchChain } from "wagmi";
import Web3, { AbiItem } from "web3";

import { useWeb3jsSigner } from "@/app/hooks";
import { useChainConfig } from "@/app/context/api/ChainConfigProvider";
import { getEstimateAbtcBurnGas } from "@/utils/getEstimateAbtcBurnGas"; // Import gas estimation function
import aBTCABI from "@/utils/ABI/aBTC.json"; 

interface EvmWalletContextType {
  evmAddress?: string | null;
  gasPrice: number | null;
  estimatedGas: number | null;
  isEvmWalletConnected: boolean;
  fetchGasDetails: (
    chainID: string,
    amount: number,
    btcAddress: string,
  ) => Promise<void>;
  burnRedeem: (
    chainID: string,
    amount: number,
    btcAddress: string,
  ) => Promise<void>;
}

const EvmWalletContext = createContext<EvmWalletContextType | undefined>(
  undefined,
);

export const EvmWalletProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { address: evmAddress, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [gasPrice, setGasPrice] = useState<number | null>(null);
  const [estimatedGas, setEstimatedGas] = useState<number | null>(null);

  const w3 = useWeb3jsSigner({
    chainId: chainId,
  });

  // Fetch the chainConfigs from the context
  const { chainConfigs } = useChainConfig();

  const fetchGasDetails = useCallback(
    async (chainID: string, amount: number, btcAddress: string) => {
      const chainConfig = chainConfigs ? chainConfigs[chainID] : null;

      if (chainConfig && evmAddress) {
        try {
          const { gasEstimate, gasPrice, success } =
            await getEstimateAbtcBurnGas(
              chainConfig.chainRpcUrl,
              chainConfig.aBTCAddress,
              evmAddress,
              amount,
              btcAddress,
            );
          if (success) {
            setGasPrice(gasPrice);
            setEstimatedGas(gasEstimate);
          }
        } catch (error) {
          console.error("Failed to fetch gas details:", error);
        }
      }
    },
    [evmAddress, chainConfigs],
  );

  const switchChain = async (chainID: string) => {
    const swtichTo = parseInt(chainID);
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: Web3.utils.toHex(swtichTo) }],
        });
      } catch (err: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (err.code === 4902) {
          const chainConfig = chainConfigs ? chainConfigs[chainID] : null;

          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainName: chainConfig?.networkName,
                chainId: Web3.utils.toHex(parseInt(chainID)),
                nativeCurrency: chainConfig?.nativeCurrency,
                rpcUrls: [chainConfig?.chainRpcUrl],
              },
            ],
          });
        }
      }
    }
  };

  const burnRedeem = async (
    burnChainID: string,
    amount: number,
    btcAddress: string,
  ) => {
    const chainConfig = chainConfigs ? chainConfigs[burnChainID] : null;

    console.log("Burning", amount, "aBTC to", btcAddress);
    console.log("Current chain ID:", chainId);
    console.log("Target burn chain ID:", burnChainID);

    if (window.ethereum && chainConfig && evmAddress) {
      if (!gasPrice && !estimatedGas) {
        console.error("Gas details not available");
        return;
      }
      // if (window.ethereum.networkVersion !== chainID) {
      //   await switchChain(chainID);
      // }

      try {
        if (Number(burnChainID) !== chainId) {
          await switchChainAsync({
            chainId: Number(burnChainID),
          });
        }

        const contract = new w3.eth.Contract(aBTCABI as AbiItem[], chainConfig.aBTCAddress);

        console.log("Contract Address", chainConfig.aBTCAddress);
        console.log("Burning aBTC", {
          amount,
          btcAddress,
          from: evmAddress,
          gas: estimatedGas?.toString(),
          gasPrice: gasPrice?.toString(),
        });
        await contract.methods.burnRedeem(amount, btcAddress).send({
          from: evmAddress,
          gas: estimatedGas?.toString(),
          gasPrice: gasPrice?.toString(),
        });
      } catch (error: any) {
        console.error("Failed to burn aBTC:", error);
        throw error;
      }
    }
  };

  return (
    <EvmWalletContext.Provider
      value={{
        evmAddress: evmAddress as string,
        gasPrice,
        estimatedGas,
        isEvmWalletConnected: isConnected,
        fetchGasDetails,
        burnRedeem,
      }}
    >
      {children}
    </EvmWalletContext.Provider>
  );
};

export const useEvmWallet = () => {
  const context = useContext(EvmWalletContext);
  if (!context) {
    throw new Error("useEvmWallet must be used within an EvmWalletProvider");
  }
  return context;
};
