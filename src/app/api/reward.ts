import axios from "axios";

export interface Reward {
  roundId: number;
  account: string;
  amount: string;
  merkleProof: string[];
}

export const getReward = async ({
  account,
}: {
  account: string;
}): Promise<Reward[]> => {
  const response = await axios.get<{
    result: {
      data: {
        rewards: Reward[];
      };
    };
  }>(
    `https://rewards-testnet.bithive.fi/getRewards?input={"account":"${account}"}`,
  );

  return response.data.result.data.rewards || [];
};
