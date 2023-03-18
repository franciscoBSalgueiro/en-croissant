import { invoke } from "@tauri-apps/api";
import { BaseDirectory, readDir } from "@tauri-apps/api/fs";

export enum Sides {
    WhiteBlack = "WhiteBlack",
    BlackWhite = "BlackWhite",
    Any = "Any",
}

export interface CompleteGame {
    game: NormalizedGame;
    currentMove: number[];
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
    page?: number;
    pageSize?: number;
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
    Unknown = "*",
    WhiteWin = "1-0",
    BlackWin = "0-1",
    Draw = "1/2-1/2",
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
    white_id: number;
    white_elo: number;
    black_id: number;
    black_elo: number;
    speed: Speed;
    outcome: Outcome;
    moves: string;
    date: string;
    site: string;
}

export interface Site {
    id: number;
    name: string;
}

function normalizeRange(
    range?: [number, number]
): [number, number] | undefined {
    if (range === undefined || range[1] - range[0] === 3000) {
        return undefined;
    }
    return range;
}

export async function query_games(
    db: string,
    query: GameQuery
): Promise<QueryResponse<NormalizedGame[]>> {
    return invoke("get_games", {
        file: db,
        query: {
            options: {
                skip_count: query.skip_count ?? false,
                page: query.page,
                page_size: query.pageSize,
                sort: query.sort,
                direction: query.direction,
            },
            player1: query.player1,
            range1: normalizeRange(query.rangePlayer1),
            player2: query.player2,
            range2: normalizeRange(query.rangePlayer2),
            sides: query.sides,
            speed: query.speed,
            outcome: query.outcome,
        },
    });
}

interface PlayerQuery extends Query {
    name?: string;
    range?: [number, number];
}

export interface Player {
    id: number;
    name: string;
    elo?: number;
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
                page: query.page,
                page_size: query.pageSize,
                sort: query.sort,
                direction: query.direction,
            },
            name: query.name,
            range: normalizeRange(query.range),
        },
    });
}

export async function getDatabases(): Promise<Database[]> {
    let files = await readDir("db", { dir: BaseDirectory.AppData });
    let dbs = files.filter((file) => file.name?.endsWith(".db3"));
    return (
        await Promise.all(
            dbs.map((db) => getDatabase(db.path).catch((e) => {
                console.log(e);
                return null;
            }))
        )
    ).filter((db) => db !== null) as Database[];
}

export async function getDatabase(path: string): Promise<Database> {
    let db = (await invoke("get_db_info", {
        file: path,
    })) as Database;
    db.file = path;
    return db;
}

export async function search_position(
    db: string,
    fen: string
): Promise<[number, number, number]> {
    return invoke("search_position", {
        file: db,
        fen,
    });
}

export async function search_opening(
    db: string,
    fen: string
): Promise<Opening[]> {
    return invoke("search_opening", {
        file: db,
        fen,
    });
}

export interface Opening {
    move: string;
    white: number;
    black: number;
    draw: number;
}

export interface NormalizedGame {
    id: number;
    event: {
        id: number;
        name: string;
    };
    site: {
        id: number;
        name: string;
    };
    date?: string;
    time?: string;
    round?: string;
    white: {
        id: number;
        name: string;
        elo?: number;
    };
    white_elo?: number;
    black: {
        id: number;
        name: string;
        elo?: number;
    };
    black_elo?: number;
    result: Outcome;
    time_control?: string;
    eco?: string;
    ply_count: number;
    fen?: string;
    moves: string;
}

export function defaultGame(): NormalizedGame {
    return {
        id: 0,
        event: {
            id: 0,
            name: "",
        },
        site: {
            id: 0,
            name: "",
        },
        white: {
            id: 0,
            name: "",
        },
        black: {
            id: 0,
            name: "",
        },
        ply_count: 0,
        moves: "",
        result: Outcome.Unknown,
    };
}
