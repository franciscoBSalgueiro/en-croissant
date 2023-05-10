import { BaseDirectory, readDir } from "@tauri-apps/api/fs";
import { invoke } from "./misc";

export enum Completion {
    CORRECT,
    INCORRECT,
    INCOMPLETE,
}

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
    puzzle_count: number;
    storage_size: number;
    path: string;
}

export async function getPuzzleDatabase(path: string): Promise<PuzzleDatabase> {
    let db = await invoke<PuzzleDatabase>("get_puzzle_db_info", {
        file: path,
    });
    return db;
}

export async function getPuzzleDatabases(): Promise<PuzzleDatabase[]> {
    let files = await readDir("puzzles", { dir: BaseDirectory.AppData });
    let dbs = files.filter((file) => file.name?.endsWith(".db3"));
    return (
        await Promise.all(
            dbs.map((db) => getPuzzleDatabase(db.path).catch(() => null))
        )
    ).filter((db) => db !== null) as PuzzleDatabase[];
}
