import { writeTextFile } from "@tauri-apps/api/fs";
import { appDataDir, resolve } from "@tauri-apps/api/path";
const base_url = "https://api.chess.com";

type ChessComPerf = {
    last: {
        rating: number;
        date: number;
        rd: number;
    };
    record: {
        win: number;
        loss: number;
        draw: number;
    };
};

export type ChessComStats = {
    chess_daily: ChessComPerf;
    chess_rapid: ChessComPerf;
    chess_blitz: ChessComPerf;
    chess_bullet: ChessComPerf;
};

type Archive = {
    archives: string[];
};

type ChessComPlayer = {
    rating: number;
    result: string;
    username: string;
};

type ChessComGames = {
    games: {
        url: string;
        pgn: string;
        time_control: string;
        end_time: number;
        rated: boolean;
        initial_setup: string;
        fen: string;
        rules: string;
        white: ChessComPlayer;
        black: ChessComPlayer;
    }[];
};

export async function getChessComAccount(player: string) {
    const url = `${base_url}/pub/player/${player}/stats`;
    const response = await fetch(url);
    return (await response.json()) as ChessComStats;
}

async function getGameArchives(player: string) {
    const url = `${base_url}/pub/player/${player}/games/archives`;
    const response = await fetch(url);
    return (await response.json()) as Archive;
}

export async function downloadChessCom(
    player: string,
    timestamp: number | null
) {
    let totalPGN = "";
    const timestampDate = new Date(timestamp ?? 0);
    const approximateDate = new Date(
        timestampDate.getFullYear(),
        timestampDate.getMonth(),
        1
    );
    const archives = await getGameArchives(player);
    for (const archive of archives.archives) {
        const [year, month] = archive.split("/").slice(-2);
        const archiveDate = new Date(parseInt(year), parseInt(month) - 1);
        if (archiveDate < approximateDate) {
            continue;
        }
        const response = await fetch(archive);
        const games: ChessComGames = await response.json();
        for (const game of games.games) {
            totalPGN += "\n" + game.pgn;
        }
    }
    writeTextFile(
        await resolve(await appDataDir(), "db", player + "_chesscom.pgn"),
        totalPGN
    );
}
