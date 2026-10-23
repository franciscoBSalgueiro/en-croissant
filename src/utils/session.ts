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

// The Databases page shows the databases linked accounts download their games into
// ("<username>_lichess.db3", "<username>_chesscom.db3", as the Accounts page finds them) apart from
// the others, each in the page's order, with headings only when there are both. Case is ignored: a
// database file keeps whatever capitalisation the account had when it was first downloaded.
export function splitAccountDatabases<Database extends { filename: string }>(
    databases: Database[],
    sessions: Session[],
) {
    const files = new Set<string>();
    for (const session of sessions) {
        if (session.lichess?.account) {
            files.add(`${session.lichess.account.username}_lichess.db3`.toLowerCase());
        }
        if (session.chessCom) {
            files.add(`${session.chessCom.username}_chesscom.db3`.toLowerCase());
        }
    }
    const isAccount = (database: Database) => files.has(database.filename.toLowerCase());
    const accounts = databases.filter(isAccount);
    const others = databases.filter((database) => !isAccount(database));
    return { accounts, others, headings: accounts.length > 0 && others.length > 0 };
}
