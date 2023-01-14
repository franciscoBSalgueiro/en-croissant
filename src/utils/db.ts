import { invoke } from "@tauri-apps/api";
import { BaseDirectory, readDir } from "@tauri-apps/api/fs";

export enum Sides {
    WhiteBlack = "WhiteBlack",
    BlackWhite = "BlackWhite",
    Any = "Any",
}

export interface Database {
    title?: string;
    description?: string;
    game_count?: number;
    player_count?: number;
    storage_size?: number;
    file: string;
}

interface Query {
    skip_count?: boolean;
    limit?: number;
    offset?: number;
    sort: string;
    direction: "asc" | "desc";
}

interface QueryResponse<T> {
    data: T;
    count: number;
}

export const enum Speed {
    UltraBullet = "UltraBullet",
    Bullet = "Bullet",
    Blitz = "Blitz",
    Rapid = "Rapid",
    Classical = "Classical",
    Correspondence = "Correspondence",
    Unknown = "Unknown",
}

export enum Outcome {
    WhiteWin = "1-0",
    BlackWin = "0-1",
    Draw = "1/2-1/2",
    Unknown = "*",
}

interface GameQuery extends Query {
    player1?: string;
    player2?: string;
    sides?: Sides;
    rangePlayer1?: [number, number];
    rangePlayer2?: [number, number];
    speed?: Speed;
    outcome?: Outcome;
}

export interface Game {
    white: number;
    white_rating: number;
    black: number;
    black_rating: number;
    speed: Speed;
    outcome: Outcome;
    moves: string;
    date: string;
    site: string;
}

export async function query_games(
    db: string,
    query: GameQuery
): Promise<QueryResponse<[Game, Player, Player][]>> {
    return invoke("get_games", {
        file: db,
        query: {
            options: {
                skip_count: query.skip_count ?? false,
                limit: query.limit,
                offset: query.offset,
                sort: query.sort,
                direction: query.direction,
            },
            player1: query.player1,
            range1: query.rangePlayer1,
            player2: query.player2,
            range2: query.rangePlayer2,
            sides: query.sides,
            speed: query.speed,
            outcome: query.outcome,
        },
    });
}

interface PlayerQuery extends Query {
    name?: string;
}

export interface Player {
    id: number;
    name: string;
    game_count: number;
    image?: string;
}

export async function query_players(
    db: string,
    query: PlayerQuery
): Promise<QueryResponse<Player[]>> {
    return invoke("get_players", {
        file: db,
        query: {
            options: {
                skip_count: query.skip_count || false,
                limit: query.limit,
                offset: query.offset,
                sort: query.sort,
                direction: query.direction,
            },
            name: query.name,
        },
    });
}

export function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export async function getDatabases() {
    let files = await readDir("db", { dir: BaseDirectory.AppData });
    let dbs = files.filter((file) => file.name?.endsWith(".sqlite"));
    return await Promise.all(dbs.map((db) => getDatabase(db.path)));
}

export async function getDatabase(path: string) {
    let db = (await invoke("get_db_info", {
        file: path,
    })) as Database;
    db.file = path;
    return db;
}
