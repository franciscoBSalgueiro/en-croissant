import { commands } from "@/bindings";
import type { FileMetadata } from "@/components/files/file";
import { unwrap } from "@/utils/unwrap";
import { Result } from "@badrap/result";
import { resolve } from "@tauri-apps/api/path";
import { exists, writeTextFile } from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import { defaultGame, makePgn } from "chessops/pgn";
import useSWR from "swr";
import { parsePGN } from "./chess";
import { type Tab, createTab } from "./tabs";
import { getGameName } from "./treeReducer";

export function usePlatform() {
  const r = useSWR("os", async () => {
    return platform();
  });
  return { os: r.data, ...r };
}

export async function openFile(
  file: string,
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  setActiveTab: React.Dispatch<React.SetStateAction<string | null>>,
) {
  const count = unwrap(await commands.countPgnGames(file));
  const input = unwrap(await commands.readGames(file, 0, 0))[0];

  const fileInfo = {
    type: "file" as const,
    metadata: {
      tags: [],
      type: "game" as const,
    },
    name: file,
    path: file,
    numGames: count,
    lastModified: new Date().getUTCSeconds(),
  };
  const tree = await parsePGN(input);
  createTab({
    tab: {
      name: getGameName(tree.headers),
      type: "analysis",
    },
    setTabs,
    setActiveTab,
    pgn: input,
    fileInfo,
  });
}

export async function createFile({
  filename,
  filetype,
  pgn,
  dir,
}: {
  filename: string;
  filetype: "game" | "repertoire" | "tournament" | "puzzle" | "other";
  pgn?: string;
  dir: string;
}): Promise<Result<FileMetadata>> {
  const file = await resolve(dir, `${filename}.pgn`);
  if (await exists(file)) {
    return Result.err(Error("File already exists"));
  }
  const metadata = {
    type: filetype,
    tags: [],
  };
  await writeTextFile(file, pgn || makePgn(defaultGame()));
  await writeTextFile(file.replace(".pgn", ".info"), JSON.stringify(metadata));
  return Result.ok({
    type: "file",
    name: filename,
    path: file,
    numGames: 1,
    metadata,
    lastModified: new Date().getUTCSeconds(),
  });
}
