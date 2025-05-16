import { useMutation, useQuery } from "@tanstack/react-query";
import { useContext } from "react";

import { NearContext } from "@/utils/near/near";

import { getReward } from "../api/reward";

export function useCheckBindReward({
  contract,
  account,
}: { contract?: string; account?: string } = {}) {
  const { wallet } = useContext(NearContext);

  return useQuery({
    queryKey: [
      "check-bind-reward",
      {
        contract,
        account,
      },
    ],
    queryFn: async () => {
      if (!contract || !wallet) return undefined;

      const result = await wallet.viewMethod({
        contractId: contract,
        method: "get_btc_recipient_address",
        args: {
          account,
        },
      });

      return result;
    },
    enabled: !!account && !!contract,
    refetchInterval: 30000,
  });
}

export function useGetBindMessage({
  contract,
  account,
  address,
}: { contract?: string; account?: string; address?: string } = {}) {
  const { wallet } = useContext(NearContext);

  return useQuery({
    queryKey: [
      "get-bind-reward-message",
      {
        contract,
        account,
        address,
      },
    ],
    queryFn: async () => {
      if (!contract || !wallet) return undefined;

      const result = await wallet.viewMethod({
        contractId: contract,
        method: "get_set_btc_recipient_address_msg",
        args: {
          account,
          recipient_address: address,
        },
      });

      return result;
    },
    enabled: !!account && !!contract && !!address,
    refetchInterval: 30000,
  });
}

export function useBindReward() {
  const { wallet } = useContext(NearContext);

  return useMutation({
    mutationFn: async ({
      contract,
      account,
      address,
      signature,
    }: {
      contract: string;
      account: string;
      address: string;
      signature: string;
    }) => {
      if (!contract || !wallet) return undefined;

      const result = await wallet.callMethod({
        contractId: contract,
        method: "set_btc_recipient_address",
        args: {
          account,
          recipient_address: address,
          signature,
        },
      });

      return result;
    },
  });
}

export function useClaimReward() {
  const { wallet } = useContext(NearContext);

  return useMutation({
    mutationFn: async ({
      contract,
      account,
      amount,
      roundId,
      proof,
    }: {
      contract: string;
      account: string;
      amount: string;
      roundId: number;
      proof: string[];
    }) => {
      if (!contract || !wallet) return undefined;

      const result = await wallet.callMethod({
        contractId: contract,
        method: "claim_single_round",
        args: {
          account,
          amount,
          round_id: roundId,
          proof,
        },
      });

      return result;
    },
  });
}

export function useCheckReward({
  account,
  contract,
}: {
  account?: string;
  contract?: string;
}) {
  const { wallet } = useContext(NearContext);

  async function getSummary(contract: string) {
    if (!wallet) return undefined;

    const result = await wallet.viewMethod({
      contractId: contract,
      method: "get_summary",
    });

    console.log(`[getSummary] ${account}`, result);

    return result;
  }

  async function canClaimRewards(contract: string) {
    if (!wallet) return undefined;

    const result = await wallet.viewMethod({
      contractId: contract,
      method: "can_claim_rewards",
      args: {
        account,
        offset: 0,
        limit: 10,
      },
    });

    console.log(
      JSON.stringify({
        contractId: contract,
        method: "can_claim_rewards",
        args: {
          account,
          offset: 0,
          limit: 10,
        },
      }),
    );

    return result;
  }

  return useQuery({
    queryKey: ["check-reward", { account, contract }],

    queryFn: async () => {
      if (!account || !contract) {
        throw new Error("Account and contract are required");
      }

      const [result, summary, canClaim] = await Promise.all([
        getReward({
          account: account,
        }),
        getSummary(contract),
        canClaimRewards(contract),
      ]);

      console.log("[getReward]", result);
      console.log("[getSummary]", summary);
      console.log("[canClaim]", canClaim);

      return {
        rewards: result,
        summary,
        canClaim: (canClaim as boolean[]) || [false],
      };
    },
    enabled: !!account && !!contract,
    refetchInterval: 30000,
  });
}
