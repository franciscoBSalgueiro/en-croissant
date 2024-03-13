import type { MonthData, Results } from "@/bindings";
import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import { BaseDirectory, readDir } from "@tauri-apps/api/fs";
import { fetch } from "@tauri-apps/api/http";
import useSWR from "swr";
import { invoke } from "./invoke";
import type { PuzzleDatabase } from "./puzzles";

export type Sides = "WhiteBlack" | "BlackWhite" | "Any";

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
  event_count?: number;
  storage_size?: number;
  downloadLink?: string;
  error?: string;
  file: string;
  indexed: boolean;
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

export type Speed =
  | "UltraBullet"
  | "Bullet"
  | "Blitz"
  | "Rapid"
  | "Classical"
  | "Correspondence"
  | "Unknown";

export type Outcome = "*" | "1-0" | "0-1" | "1/2-1/2";

export interface GameQuery extends Query {
  player1?: number;
  player2?: number;
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
  range?: [number, number],
): [number, number] | undefined {
  if (range === undefined || range[1] - range[0] === 3000) {
    return undefined;
  }
  return range;
}

export async function query_games(
  db: string,
  query: GameQuery,
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
  query: PlayerQuery,
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
  query: TournamentQuery,
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
  const files = await readDir("db", { dir: BaseDirectory.AppData });
  const dbs = files.filter((file) => file.name?.endsWith(".db3"));
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
      () => true,
    );
  } catch (e) {
    db = {
      filename: path,
      file: path,
      error: e as string,
      indexed: false,
    };
  }
  db.file = path;
  return db;
}

export function useDefaultDatabases(opened: boolean) {
  const { data, error, isLoading } = useSWR(
    opened ? "default-dbs" : null,
    async () => {
      const data = await fetch<DatabaseInfo[]>(
        "https://www.encroissant.org/databases",
        {
          method: "GET",
        },
      );
      if (!data.ok) {
        throw new Error("Failed to fetch engines");
      }
      return data.data;
    },
  );
  return {
    defaultDatabases: data,
    error,
    isLoading,
  };
}

export async function getDefaultPuzzleDatabases(): Promise<PuzzleDatabase[]> {
  const data = await fetch<PuzzleDatabase[]>(
    "https://www.encroissant.org/puzzle_databases",
    {
      method: "GET",
    },
  );
  if (!data.ok) {
    throw new Error("Failed to fetch puzzle databases");
  }
  return data.data;
}

export interface Opening {
  move: string;
  white: number;
  black: number;
  draw: number;
}

export type NormalizedGame = {
  id: number;
  fen: string;
  event: string;
  event_id: number;
  site: string;
  site_id: number;
  date?: string;
  time?: string;
  round?: string;
  white: string;
  white_id: number;
  white_elo?: number | null;
  black: string;
  black_id: number;
  black_elo?: number | null;
  result: Outcome;
  time_control?: string;
  eco?: string;
  ply_count: number;
  white_material?: number;
  black_material?: number;
  moves: string;
};

export async function getTournamentGames(file: string, id: number) {
  return await query_games(file, {
    direction: "asc",
    sort: "id",
    tournament_id: id,
    skip_count: true,
  });
}

export interface PlayerGameInfo {
  won: number;
  lost: number;
  draw: number;
  data_per_month: [string, MonthData][];
  white_openings: [string, Results][];
  black_openings: [string, Results][];
}

export async function searchPosition(options: LocalOptions, tab: string) {
  const openings: [Opening[], NormalizedGame[]] = await invoke(
    "search_position",
    {
      file: options.path,
      query: options,
      tabId: tab,
    },
    (s) => s === "Search stopped",
  );
  return openings;
}

export async function count_pgn_games(file: string) {
  return await invoke<number>("count_pgn_games", {
    file,
  });
}

export async function read_games(file: string, start: number, end: number) {
  const games = await invoke<string[]>("read_games", {
    file,
    start,
    end,
  });
  return games;
}
