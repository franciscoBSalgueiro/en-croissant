import { resolve } from "@tauri-apps/api/path";
import { readDir } from "@tauri-apps/plugin-fs";
import { commands, type PuzzleDatabaseInfo } from "@/bindings";
import { getPuzzlesDir } from "@/utils/directories";
import { unwrap } from "./unwrap";

export type Completion = "correct" | "incorrect" | "incomplete";

export interface Puzzle {
    id: number;
    fen: string;
    moves: string[];
    rating: number;
    rating_deviation: number;
    popularity: number;
    nb_plays: number;
    completion: Completion;
    timeSpent?: number;
    themes?: string[];
}

async function getPuzzleDatabase(name: string): Promise<PuzzleDatabaseInfo | null> {
    const puzzlesDir = await getPuzzlesDir();
    const path = await resolve(puzzlesDir, name);
    return unwrap(await commands.getPuzzleDbInfo(path));
}

export async function getPuzzleDatabases(): Promise<PuzzleDatabaseInfo[]> {
    const puzzlesDir = await getPuzzlesDir();
    const files = await readDir(puzzlesDir);
    const dbs = files.filter((file) => /\.(duckdb|db3)$/i.test(file.name ?? ""));
    return (await Promise.allSettled(dbs.map((db) => getPuzzleDatabase(db.name)))).flatMap((r) =>
        r.status === "fulfilled" && r.value ? [r.value] : [],
    );
}
