import { useMemo } from "react";

import { useAppContext } from "@/app/context/app";
import { useCheckBindReward, useGetBindMessage } from "@/app/hooks/reward";
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

  console.log("[getBindMessage]", getBindMessage);

  async function signMessage() {
    if (!btcWallet || !getBindMessage) return;

    const message = getBindMessage?.message;
    const signature = await btcWallet.signMessageBIP322(message);
    console.log("[signature]", signature);
  }

  const handleConnectModal = () => {
    connect();
  };

  return (
    <RequireConnectWallet
      required={!fromAddress}
      onConnect={handleConnectModal}
      description="Please connect wallet to earn rewards"
      renderContent={
        <>
          <div>
            <p>Reward</p>
          </div>
        </>
      }
    />
  );
}
