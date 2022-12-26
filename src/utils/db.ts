import { invoke } from "@tauri-apps/api";

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
}

export enum Outcome {
    WhiteWin = "1-0",
    BlackWin = "0-1",
    Draw = "1/2-1/2",
    Unknown = "*",
}

interface GameQuery {
    white?: string;
    black?: string;
    white_rating?: [number, number];
    black_rating?: [number, number];
    speed?: Speed;
    outcome?: Outcome;
    limit?: number;
    offset?: number;
}

export interface Game {
    id: string;
    white: Player;
    black: Player;
    speed: Speed;
    outcome: Outcome;
    moves: string;
    date: string;
}

export async function query_games(
    db: string,
    query: GameQuery
): Promise<QueryResponse<Game[]>> {
    console.log(query);
    return invoke("get_games", {
        file: db,
        query: {
            white: query.white,
            black: query.black,
            speed: query.speed,
            outcome: query.outcome,
            limit: query.limit,
            offset: query.offset,
        },
    });
}

interface PlayerQuery {
    name?: string;
    limit?: number;
    offset?: number;
}

export interface Player {
    id: string;
    name: string;
    rating?: number;
}

export async function query_players(
    db: string,
    query: PlayerQuery
): Promise<Player[]> {
    return invoke("get_players", {
        file: db,
        query: {
            name: query.name,
            limit: query.limit,
            offset: query.offset,
        },
    });
}
