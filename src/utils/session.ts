import type { ChessComStats } from "@/utils/chess.com/api";
import type { LichessAccount } from "@/utils/lichess/api";

export type LichessSession = {
  accessToken?: string;
  username: string;
  account: LichessAccount;
};

export type ChessComSession = {
  username: string;
  stats: ChessComStats;
};

export type Session = {
  lichess?: LichessSession;
  chessCom?: ChessComSession;
  player?: string;
  updatedAt: number;
};
