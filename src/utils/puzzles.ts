import { resolve } from "@tauri-apps/api/path";
import { notifications } from "@mantine/notifications";
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

export async function getPuzzleDatabase(name: string): Promise<PuzzleDatabaseInfo | null> {
    const puzzlesDir = await getPuzzlesDir();
    const path = await resolve(puzzlesDir, name);
    return unwrap(await commands.getPuzzleDbInfo(path));
}

const reportedErrors = new Set<string>();

export async function getPuzzleDatabases(): Promise<PuzzleDatabaseInfo[]> {
    const puzzlesDir = await getPuzzlesDir();
    const files = await readDir(puzzlesDir);
    const dbs = files.filter((file) => /\.(duckdb|db3)$/i.test(file.name ?? ""));
    const results = await Promise.allSettled(dbs.map((db) => getPuzzleDatabase(db.name)));
    // Don't hide broken files silently: say which one failed and why.
    results.forEach((r, i) => {
        if (r.status !== "rejected") return;
        const name = dbs[i].name ?? "";
        const message = `${name}: ${r.reason}`;
        if (reportedErrors.has(message)) return;
        reportedErrors.add(message);
        notifications.show({
            title: "Puzzle-Datenbank lässt sich nicht öffnen",
            message: `${message}\nLösche die Datei unter Puzzles → Datenbank hinzufügen und lade sie neu.`,
            color: "red",
            autoClose: false,
        });
    });
    return results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
}
