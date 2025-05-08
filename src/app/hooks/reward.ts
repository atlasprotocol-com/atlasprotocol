import { useMutation, useQuery } from "@tanstack/react-query";
import { useContext } from "react";

import { NearContext } from "@/utils/near/near";

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
