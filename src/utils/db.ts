import { resolve } from "@tauri-apps/api/path";
import { readDir } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import useSWR from "swr";
import {
    commands,
    type DatabaseInfo,
    type GameQuery,
    type NormalizedGame,
    type Player,
    type PlayerQuery,
    type PuzzleDatabaseInfo,
    type QueryResponse,
} from "@/bindings";
import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import { getDatabasesDir } from "@/utils/directories";
import { unwrap } from "./unwrap";

export type SuccessDatabaseInfo = Extract<DatabaseInfo, { type: "success" }>;

/** Virtual path for `EnCroissantEngineGames.db` in the databases list (not a `.db3` in the databases folder). */
export const ENC_LOCAL_PLAYED_GAMES_DB_FILE = "__encLocalPlayedGames__";

export function isEncLocalPlayedGamesDb(file: string): boolean {
    return file === ENC_LOCAL_PLAYED_GAMES_DB_FILE;
}

export interface CompleteGame {
    game: NormalizedGame;
    currentMove: number[];
}

export type Speed =
    | "UltraBullet"
    | "Bullet"
    | "Blitz"
    | "Rapid"
    | "Classical"
    | "Correspondence"
    | "Unknown";

function normalizeRange(range?: [number, number] | null): [number, number] | undefined {
    if (!range || range[1] - range[0] === 3000) {
        return undefined;
    }
    return range;
}

function build_game_query_for_commands(query: GameQuery): GameQuery {
    return {
        player1: query.player1,
        range1: normalizeRange(query.range1),
        player2: query.player2,
        range2: normalizeRange(query.range2),
        tournament_id: query.tournament_id,
        player1Side: query.player1Side,
        player2Side: query.player2Side,
        outcome: query.outcome,
        start_date: query.start_date,
        end_date: query.end_date,
        position: null,
        options: query.options
            ? {
                  skipCount: query.options.skipCount ?? false,
                  page: query.options.page,
                  pageSize: query.options.pageSize,
                  sort: query.options.sort || "id",
                  direction: query.options.direction || "desc",
              }
            : undefined,
    };
}

export async function query_games(
    db: string,
    query: GameQuery,
): Promise<QueryResponse<NormalizedGame[]>> {
    return unwrap(await commands.getGames(db, build_game_query_for_commands(query)));
}

/** Exports every game matching the current filters into a new `.db3` database (same filter semantics as the games table, without pagination). */
export async function export_filtered_games(
    db: string,
    query: GameQuery,
    destPath: string,
    title: string,
): Promise<number> {
    return unwrap(
        await commands.exportFilteredGamesToDatabase(
            db,
            build_game_query_for_commands(query),
            destPath,
            title,
        ),
    );
}

/** Board view: same `GameQuery` as `searchPosition` (includes `position`). */
export async function export_board_filtered_games(
    db: string,
    query: GameQuery,
    destPath: string,
    title: string,
): Promise<number> {
    return unwrap(await commands.exportFilteredGamesToDatabase(db, query, destPath, title));
}

export async function query_players(
    db: string,
    query: PlayerQuery,
): Promise<QueryResponse<Player[]>> {
    return unwrap(
        await commands.getPlayers(db, {
            options: {
                skipCount: query.options.skipCount || false,
                page: query.options.page,
                pageSize: query.options.pageSize,
                sort: query.options.sort,
                direction: query.options.direction,
            },
            name: query.name,
            range: normalizeRange(query.range),
        }),
    );
}

export async function getDatabases(): Promise<DatabaseInfo[]> {
    const dbDir = await getDatabasesDir();
    const files = await readDir(dbDir);
    const dbs = files.filter((file) => file.name?.endsWith(".db3"));
    const normal = (await Promise.allSettled(dbs.map((db) => getDatabase(db.name!))))
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<DatabaseInfo>).value);

    const encRes = await commands.getDbInfo(ENC_LOCAL_PLAYED_GAMES_DB_FILE);
    const enc: DatabaseInfo =
        encRes.status === "ok"
            ? {
                  type: "success",
                  ...encRes.data,
                  file: ENC_LOCAL_PLAYED_GAMES_DB_FILE,
              }
            : {
                  type: "error",
                  filename: ENC_LOCAL_PLAYED_GAMES_DB_FILE,
                  file: ENC_LOCAL_PLAYED_GAMES_DB_FILE,
                  error: encRes.error,
                  indexed: false,
              };

    return [enc, ...normal];
}

async function getDatabase(name: string): Promise<DatabaseInfo> {
    const dbDir = await getDatabasesDir();
    const path = await resolve(dbDir, name);
    const res = await commands.getDbInfo(path);
    if (res.status === "ok") {
        return {
            type: "success",
            ...res.data,
            file: path,
        };
    }
    return {
        type: "error",
        filename: path,
        file: path,
        error: res.error,
        indexed: false,
    };
}

export function useDefaultDatabases(opened: boolean) {
    const { data, error, isLoading } = useSWR(opened ? "default-dbs" : null, async () => {
        const data = await fetch("https://www.encroissant.org/databases", {
            method: "GET",
        });
        if (!data.ok) {
            throw new Error("Failed to fetch engines");
        }
        return (await data.json()) as SuccessDatabaseInfo[];
    });
    return {
        defaultDatabases: data,
        error,
        isLoading,
    };
}

export async function getDefaultPuzzleDatabases(): Promise<
    (PuzzleDatabaseInfo & { downloadLink: string })[]
> {
    const data = await fetch("https://www.encroissant.org/puzzle_databases", {
        method: "GET",
    });
    if (!data.ok) {
        throw new Error("Failed to fetch puzzle databases");
    }
    return (await data.json()) as (PuzzleDatabaseInfo & {
        downloadLink: string;
    })[];
}

export interface Opening {
    move: string;
    white: number;
    black: number;
    draw: number;
}

export async function getTournamentGames(file: string, id: number) {
    return await query_games(file, {
        options: {
            direction: "asc",
            sort: "id",
            skipCount: true,
        },
        tournament_id: id,
    });
}

export async function searchPosition(options: LocalOptions, tab: string) {
    const res = await commands.searchPosition(
        options.path!,
        {
            player1: options.player ?? undefined,
            player2: options.player2 ?? undefined,
            player1Side: options.player1Side,
            player2Side: options.player2Side,
            position: {
                fen: options.fen,
                type_: options.type,
            },
            start_date: options.start_date,
            end_date: options.end_date,
            wanted_result: options.result === "any" ? undefined : options.result,
        },
        tab,
    );
    if (res.status === "error") {
        if (res.error !== "Search stopped") {
            unwrap(res);
        }
        return Promise.reject();
    }
    return res.data;
}
