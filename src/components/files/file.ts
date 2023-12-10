import { count_pgn_games } from "@/utils/db";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import { z } from "zod";

const fileTypeSchema = z.enum([
    "repertoire",
    "game",
    "tournament",
    "puzzle",
    "other",
]);

export type FileType = z.infer<typeof fileTypeSchema>;

const fileInfoMetadataSchema = z.object({
    type: fileTypeSchema,
    tags: z.array(z.string()),
});

export type FileInfoMetadata = z.infer<typeof fileInfoMetadataSchema>;

export const fileMetadataSchema = z.object({
    name: z.string(),
    path: z.string(),
    numGames: z.number(),
    metadata: fileInfoMetadataSchema,
});

export type FileMetadata = z.infer<typeof fileMetadataSchema>;

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
