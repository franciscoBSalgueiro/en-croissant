import { BaseDirectory, readDir } from "@tauri-apps/api/fs";
import { fetch } from "@tauri-apps/api/http";
import { invoke } from "./misc";

export enum Sides {
    WhiteBlack = "WhiteBlack",
    BlackWhite = "BlackWhite",
    Any = "Any",
}

export interface CompleteGame {
    game: NormalizedGame;
    currentMove: number[];
}

export interface DatabaseInfo {
    title?: string;
    description?: string;
    filename: string;
    game_count?: number;
    player_count?: number;
    storage_size?: number;
    downloadLink?: string;
    error?: string;
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
    tournament_id?: number;
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
            tournament_id: query.tournament_id,
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

interface TournamentQuery extends Query {
    name?: string;
}

export interface Tournament {
    id: number;
    name: string;
}

export async function query_tournaments(
    db: string,
    query: TournamentQuery
): Promise<QueryResponse<Tournament[]>> {
    return invoke("get_tournaments", {
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
        },
    });
}

export async function getDatabases(): Promise<DatabaseInfo[]> {
    let files = await readDir("db", { dir: BaseDirectory.AppData });
    let dbs = files.filter((file) => file.name?.endsWith(".db3"));
    return await Promise.all(dbs.map((db) => getDatabase(db.path)));
}

export async function getDatabase(path: string): Promise<DatabaseInfo> {
    let db: DatabaseInfo;
    try {
        db = await invoke<DatabaseInfo>(
            "get_db_info",
            {
                file: path,
            },
            () => true
        );
    } catch (e) {
        db = {
            filename: path,
            file: path,
            error: e as string,
        };
    }
    db.file = path;
    return db;
}

export async function getDefaultDatabases(): Promise<DatabaseInfo[]> {
    let data: any = await fetch(`https://www.encroissant.org/databases`, {
        method: "GET",
    });
    if (!data.ok) {
        throw new Error("Failed to fetch engines");
    }
    return data.data;
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
    white_elo?: number | null;
    black: {
        id: number;
        name: string;
        elo?: number;
    };
    black_elo?: number | null;
    result: Outcome;
    time_control?: string;
    eco?: string;
    ply_count: number;
    white_material?: number;
    black_material?: number;
    fen?: string;
    moves: string;
}


export async function getTournamentGames(
    file: string,
    id: number,
) {
    return await query_games(file, {
        direction: "asc",
        sort: "id",
        tournament_id: id,
        skip_count: true,
    });
}

export async function getPlayersGameInfo(
    file: string,
    player?: Player,
    username?: string
) {
    if (username) {
        const players = await query_players(file, {
            name: username,
            pageSize: 1,
            direction: "asc",
            sort: "id",
        });
        if (players.data.length > 0) {
            player = players.data[0];
        }
    }
    return await invoke("get_players_game_info", {
        file,
        id: player?.id,
    });
}

export async function searchPosition(
    referenceDatabase: string | null,
    fen: string
) {
    let openings: [Opening[], NormalizedGame[]] = await invoke(
        "search_position",
        {
            file: referenceDatabase,
            fen,
        },
        (s) => s === "Search stopped"
    );
    return openings;
}
