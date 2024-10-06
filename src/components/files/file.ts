import { commands } from "@/bindings";
import { unwrap } from "@/utils/unwrap";
import { BaseDirectory, basename, join } from "@tauri-apps/api/path";
import {
  type DirEntry,
  exists,
  readDir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
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
  type: z.literal("file"),
  name: z.string(),
  path: z.string(),
  numGames: z.number(),
  metadata: fileInfoMetadataSchema,
  lastModified: z.number(),
});

export type FileMetadata = z.infer<typeof fileMetadataSchema>;

export type FileData = {
  metadata: FileInfoMetadata;
  games: string[];
};

async function readFileMetadata(path: string): Promise<FileMetadata | null> {
  if (!path.endsWith(".pgn")) {
    return null;
  }
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
  const fileMetadata = unwrap(await commands.getFileMetadata(path));
  const numGames = unwrap(await commands.countPgnGames(path));
  return {
    type: "file",
    path,
    name: (await basename(path)).replace(".pgn", ""),
    numGames,
    metadata,
    lastModified: fileMetadata.last_modified,
  };
}

export type Directory = {
  type: "directory";
  children: (FileMetadata | Directory)[];
  path: string;
  name: string;
};

export async function processEntriesRecursively(
  parent: string,
  entries: DirEntry[],
) {
  const allEntries: (FileMetadata | Directory)[] = [];
  for (const entry of entries) {
    if (entry.isFile) {
      const metadata = await readFileMetadata(await join(parent, entry.name));
      if (!metadata) continue;
      allEntries.push(metadata);
    }
    if (entry.isDirectory) {
      const dir = await join(parent, entry.name);
      const newEntries = await processEntriesRecursively(
        dir,
        await readDir(dir, { baseDir: BaseDirectory.AppLocalData }),
      );
      allEntries.push({
        type: "directory",
        name: entry.name,
        path: dir,
        children: newEntries,
      });
    }
  }
  return allEntries;
}
