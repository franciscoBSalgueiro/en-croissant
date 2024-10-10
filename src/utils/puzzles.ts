import { type PuzzleDatabaseInfo, commands } from "@/bindings";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { BaseDirectory, readDir } from "@tauri-apps/plugin-fs";
import { unwrap } from "./unwrap";

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

async function getPuzzleDatabase(name: string): Promise<PuzzleDatabaseInfo> {
  const appDataDirPath = await appDataDir();
  const path = await resolve(appDataDirPath, "puzzles", name);
  return unwrap(await commands.getPuzzleDbInfo(path));
}

export async function getPuzzleDatabases(): Promise<PuzzleDatabaseInfo[]> {
  const files = await readDir("puzzles", { baseDir: BaseDirectory.AppData });
  const dbs = files.filter((file) => file.name?.endsWith(".db3"));
  return (await Promise.allSettled(dbs.map((db) => getPuzzleDatabase(db.name))))
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<PuzzleDatabaseInfo>).value);
}
