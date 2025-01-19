// https://api-xmsw63ow5a-as.a.run.app/balance?user_address=buglungtung.testnet

import axios from "axios";

export interface GetPointsResponse {
  data: PointInfo[];
}

export interface PointInfo {
  id: string;
  user_address: string;
  token_id: string;
  updated_at: number;
  multiplier: Multiplier;
  multiplier_total: number;
  token_amount: Multiplier;
  token_balance: number;
  point_total: number;
  point_total_after_multiplier: number;
}

export interface Multiplier {
  burrow: number;
  reffinance: number;
}

export const getUserPoints = async ({
  address,
}: {
  address: string;
}): Promise<PointInfo | null> => {
  const response = await axios.get<GetPointsResponse>(
    `https://api-xmsw63ow5a-as.a.run.app/balance?user_address=${address}`,
  );

  if (response.data.data.length === 0) {
    return null;
  }

  return response.data.data[0];
};

export interface GetPointsLeaderBoardResponse {
  data: PointInfo[];
}

export const getUserPointsLeaderBoard = async (): Promise<
  PointInfo[] | null
> => {
  const response = await axios.get<GetPointsLeaderBoardResponse>(
    `https://api-xmsw63ow5a-as.a.run.app/leaderboard`,
  );

  if (response.data.data?.length === 0) {
    return null;
  }

  return response.data.data;
};
