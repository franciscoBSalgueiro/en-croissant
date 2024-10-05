import { appDataDir, resolve } from "@tauri-apps/api/path";
import { BaseDirectory, readDir } from "@tauri-apps/plugin-fs";
import { invoke } from "./invoke";

export type Completion = "correct" | "incorrect" | "incomplete";

export interface Puzzle {
  fen: string;
  moves: string[];
  rating: number;
  rating_deviation: number;
  popularity: number;
  nb_plays: number;
  completion: Completion;
}

export interface PuzzleDatabase {
  title: string;
  description: string;
  puzzle_count: number;
  storage_size: number;
  path: string;
  downloadLink?: string;
}

async function getPuzzleDatabase(name: string): Promise<PuzzleDatabase> {
  const appDataDirPath = await appDataDir();
  const path = await resolve(appDataDirPath, name);
  const db = await invoke<PuzzleDatabase>("get_puzzle_db_info", {
    file: path,
  });
  return db;
}

export async function getPuzzleDatabases(): Promise<PuzzleDatabase[]> {
  const files = await readDir("puzzles", { baseDir: BaseDirectory.AppData });
  const dbs = files.filter((file) => file.name?.endsWith(".db3"));
  return (await Promise.allSettled(dbs.map((db) => getPuzzleDatabase(db.name))))
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<PuzzleDatabase>).value);
}
