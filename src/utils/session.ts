import { ChessComStats } from "./chesscom";
import { LichessAccount } from "./lichess";

type LichessSession = {
    accessToken?: string;
    username?: string;
    account: LichessAccount;
};

type ChessComSession = {
    username: string;
    stats: ChessComStats;
};

export type Session = {
    lichess?: LichessSession;
    chessCom?: ChessComSession;
    updatedAt: number;
};
