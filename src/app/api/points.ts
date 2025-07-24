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
    "Error getting stats",
  );
  return response.data.data;
};
