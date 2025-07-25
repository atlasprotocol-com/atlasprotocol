import { apiWrapper } from "./apiWrapper";

export const getUserPoints = async ({
  address,
}: {
  address: string;
}): Promise<{ [name: string]: number }> => {
  console.log("getUserPoints");
  const response = await apiWrapper(
    "GET",
    `/api/v1/balance/points?address=${address}`,
    "Error getting user points",
  );
  return response.data.data;
};

export const getUserPointsLeaderboard = async ({
  limit,
}: {
  limit: number;
}): Promise<Array<{ wallet_address: string; points: number }>> => {
  console.log("getUserPointsLeaderboard");
  const response = await apiWrapper(
    "GET",
    `/api/v1/balance/points/leaderboard?limit=${limit}`,
    "Error getting user points leaderboard",
  );
  return response.data.data;
};
