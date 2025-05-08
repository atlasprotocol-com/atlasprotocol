import { useMemo } from "react";

import { useAppContext } from "@/app/context/app";
import {
  useBindReward,
  useCheckBindReward,
  useGetBindMessage,
} from "@/app/hooks/reward";
import { useConnectMultiChain } from "@/app/hooks/useConnectMultiChain";
import { ChainConfig } from "@/app/types/chainConfig";
import { useGetChainConfig } from "@/hooks";

import { RequireConnectWallet } from "../RequireConnectWallet";

const Contract = "rewards-incent2.bithive.testnet";

export function Reward() {
  const { btcPublicKeyHex, btcWallet } = useAppContext();
  const { data: chainConfigs = {} } = useGetChainConfig();

  const selectedChain = useMemo(() => {
    return Object.values(chainConfigs || {}).find(
      (chainConfig) => chainConfig.networkType === "NEAR",
    ) as ChainConfig | undefined;
  }, [chainConfigs]);

  const { data: checkBindReward } = useCheckBindReward({
    account: `btc:${btcPublicKeyHex}`,
    contract: Contract,
  });

  const { mutateAsync: bindReward } = useBindReward();

  const {
    disconnectAsync,
    address: fromAddress,
    connect,
  } = useConnectMultiChain({
    selectedChain,
    lazyConnect: true,
  });

  const { data: getBindMessage } = useGetBindMessage({
    account: `btc:${btcPublicKeyHex}`,
    address: fromAddress || undefined,
    contract: Contract,
  });

  async function signMessage() {
    if (!btcWallet || !getBindMessage || !fromAddress) return;

    const signature = await btcWallet.signMessageBIP322(getBindMessage);

    console.log("[signature]", signature);

    const result = await bindReward({
      account: `btc:${btcPublicKeyHex}`,
      contract: Contract,
      address: fromAddress,
      signature,
    });

    console.log("[result]", result);
  }

  const handleConnectModal = () => {
    connect();
  };

  console.log("[checkBindReward]", checkBindReward);

  return (
    <RequireConnectWallet
      required={!fromAddress}
      onConnect={handleConnectModal}
      description="Please connect wallet to earn rewards"
      renderContent={
        <>
          <div>
            <p>Reward</p>
            <button onClick={signMessage}>Sign Message</button>
          </div>
        </>
      }
    />
  );
}
