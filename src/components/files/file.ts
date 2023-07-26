import { count_pgn_games } from "@/utils/db";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/api/fs";

export type FileType =
    | "repertoire"
    | "game"
    | "tournament"
    | "puzzle"
    | "other";

type FileInfoMetadata = {
    type: FileType;
    tags: string[];
};

export type FileMetadata = {
    name: string;
    path: string;
    numGames: number;
    metadata: FileInfoMetadata;
};

export type FileData = {
    metadata: FileInfoMetadata;
    games: string[];
};

export async function readFileMetadata(
    name: string,
    path: string
): Promise<FileMetadata> {
    const metadataPath = path.replace(".pgn", ".info");
    let metadata: FileInfoMetadata;
    if (await exists(metadataPath)) {
        metadata = JSON.parse(await readTextFile(metadataPath));
    } else {
        metadata = {
            type: "other",
            tags: [],
        };
        await writeTextFile(metadataPath, JSON.stringify(metadata));
    }
    const numGames = await count_pgn_games(path);
    return { path, name: name.replace(".pgn", ""), numGames, metadata };
}
