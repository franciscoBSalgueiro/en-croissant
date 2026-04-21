import { resolve } from "@tauri-apps/api/path";
import { readDir } from "@tauri-apps/plugin-fs";
import { z } from "zod";
import {
    commands,
    type PuzzleDatabaseInfo,
    type SavedPuzzleSession,
    type SessionPuzzle,
} from "@/bindings";
import { getPuzzlesDir } from "@/utils/directories";
import { unwrap } from "./unwrap";

export type Completion = "correct" | "incorrect" | "incomplete";

export const puzzleSchema = z.object({
    id: z.number(),
    fen: z.string(),
    moves: z.array(z.string()),
    rating: z.number(),
    rating_deviation: z.number(),
    popularity: z.number(),
    nb_plays: z.number(),
    completion: z.enum(["correct", "incorrect", "incomplete"]),
    timeSpent: z.number().optional(),
    themes: z.array(z.string()).optional(),
});

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

// Re-export backend types so consumers only need one import
export type { SavedPuzzleSession, SessionPuzzle };

/** Convert an active-session Puzzle to the backend SessionPuzzle shape. */
export function toSessionPuzzle(p: Puzzle): SessionPuzzle {
    return {
        id: p.id,
        fen: p.fen,
        moves: p.moves,
        rating: p.rating,
        ratingDeviation: p.rating_deviation,
        popularity: p.popularity,
        nbPlays: p.nb_plays,
        completion: p.completion,
        timeSpent: p.timeSpent ?? null,
        themes: p.themes ?? null,
    };
}

/** Convert a stored SessionPuzzle back into an active-session Puzzle. */
export function fromSessionPuzzle(p: SessionPuzzle): Puzzle {
    return {
        id: p.id,
        fen: p.fen,
        moves: p.moves,
        rating: p.rating,
        rating_deviation: p.ratingDeviation,
        popularity: p.popularity,
        nb_plays: p.nbPlays,
        completion: p.completion as Completion,
        timeSpent: p.timeSpent ?? undefined,
        themes: p.themes ?? undefined,
    };
}

async function getPuzzleDatabase(name: string): Promise<PuzzleDatabaseInfo> {
    const puzzlesDir = await getPuzzlesDir();
    const path = await resolve(puzzlesDir, name);
    return unwrap(await commands.getPuzzleDbInfo(path));
}

export async function getPuzzleDatabases(): Promise<PuzzleDatabaseInfo[]> {
    const puzzlesDir = await getPuzzlesDir();
    const files = await readDir(puzzlesDir);
    const dbs = files.filter((file) => file.name?.endsWith(".db3"));
    return (await Promise.allSettled(dbs.map((db) => getPuzzleDatabase(db.name))))
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<PuzzleDatabaseInfo>).value);
}
