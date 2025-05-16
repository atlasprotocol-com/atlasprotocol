import { useAppContext } from "@/app/context/app";
import {
  useBindReward,
  useCheckBindReward,
  useCheckReward,
  useClaimReward,
  useGetBindMessage,
} from "@/app/hooks/reward";
import { useConnectMultiChain } from "@/app/hooks/useConnectMultiChain";
import { ChainConfig } from "@/app/types/chainConfig";
import { useGetChainConfig } from "@/hooks";
import { utils } from "near-api-js";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "../Button";
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

  const {
    data: checkBindReward,
    isLoading: isCheckingBindReward,
    refetch: refetchCheckBindReward,
  } = useCheckBindReward({
    account: btcPublicKeyHex ? `btc:${btcPublicKeyHex}` : undefined,
    contract: Contract,
  });

  const { data: reward, isLoading: isGettingReward } = useCheckReward({
    account: btcPublicKeyHex ? `btc:${btcPublicKeyHex}` : undefined,
    // account:
    //   "btc:024d13158e45a5a99442217fc507709bef512191a83ab901878b35033555a5dd3e",
    contract: Contract,
  });

  const { mutateAsync: bindReward } = useBindReward();

  const { address: fromAddress, connect } = useConnectMultiChain({
    selectedChain,
    lazyConnect: true,
  });

  const { data: getBindMessage } = useGetBindMessage({
    account: btcPublicKeyHex ? `btc:${btcPublicKeyHex}` : undefined,
    address: fromAddress || undefined,
    contract: Contract,
  });

  const { mutateAsync: claimReward } = useClaimReward();

  const handleConnectModal = () => {
    connect();
  };

  const [isClaiming, setIsClaiming] = useState(false);

  const claimable = (reward?.canClaim || [])
    .map((can, index) => (can ? reward?.rewards[index] || null : null))
    .filter((x) => !!x);

  async function handleClaimReward() {
    if (claimable.length === 0) {
      throw new Error("You cannot claim rewards yet");
    }

    if (!btcWallet || !getBindMessage || !fromAddress) {
      throw new Error("Missing required parameters for binding");
    }

    setIsClaiming(true);

    try {
      if (!checkBindReward) {
        const signature = await btcWallet.signMessageBIP322(getBindMessage);

        await bindReward({
          account: `btc:${btcPublicKeyHex}`,
          contract: Contract,
          address: fromAddress,
          signature: signature,
        });

        await refetchCheckBindReward();
      }

      await claimReward({
        account: `btc:${btcPublicKeyHex}`,
        contract: Contract,
        amount: claimable[0].amount,
        roundId: claimable[0].roundId,
        proof: claimable[0].merkleProof,
      });
    } catch (error) {
      toast.error("Failed to claim reward");
      console.error(error);
    } finally {
      setIsClaiming(false);
    }
  }

  const isLoading = isCheckingBindReward || isGettingReward;
  const hasClaimableReward = claimable.length > 0;

  return (
    <RequireConnectWallet
      required={!fromAddress}
      onConnect={handleConnectModal}
      description="Please connect your NEAR wallet to earn rewards"
      renderContent={
        <div className="flex flex-col items-center justify-center gap-4">
          {!isLoading && hasClaimableReward && (
            <p>
              You have total{" "}
              {utils.format.formatNearAmount(claimable[0].amount)} Near rewards
            </p>
          )}
          <div className="flex justify-center">
            <Button
              className="min-w-[200px]"
              disabled={isLoading || isClaiming || claimable.length === 0}
              onClick={handleClaimReward}
            >
              {isLoading
                ? "Checking reward..."
                : hasClaimableReward
                  ? "Claim current reward"
                  : "You cannot claim rewards yet"}
            </Button>
          </div>
        </div>
      }
    />
  );
}
