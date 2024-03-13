import type { ChessComStats } from "@/utils/chess.com/api";
import type { LichessAccount } from "@/utils/lichess/api";

type LichessSession = {
  accessToken?: string;
  username: string;
  account: LichessAccount;
};

type ChessComSession = {
  username: string;
  stats: ChessComStats;
};

export type Session = {
  lichess?: LichessSession;
  chessCom?: ChessComSession;
  player?: string;
  updatedAt: number;
};
