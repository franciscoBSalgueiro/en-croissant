import { commands } from "@/bindings";
import type { FileMetadata } from "@/components/files/file";
import { unwrap } from "@/utils/unwrap";
import { Result } from "@badrap/result";
import { arch, platform } from "@tauri-apps/plugin-os";
import { defaultGame, makePgn } from "chessops/pgn";
import useSWR from "swr";
import { parsePGN } from "./chess";
import { type Tab, createTab } from "./tabs";
import { getGameName } from "./treeReducer";

export function usePlatform() {
  const { data: os, ...rest } = useSWR("os", platform);
  const { data: archData } = useSWR("arch", arch);
  return { os, arch: archData, ...rest };
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
  // Web-first storage: persist under localStorage namespace
  try {
    const key = `files:${dir}:${filename}.pgn`;
    const metaKey = key.replace('.pgn', '.info');
    if (localStorage.getItem(key) != null) {
      return Result.err(Error("File already exists"));
    }
    const metadata = { type: filetype, tags: [] } as const;
    const content = pgn || makePgn(defaultGame());
    localStorage.setItem(key, content);
    localStorage.setItem(metaKey, JSON.stringify(metadata));
    return Result.ok({
      type: "file",
      name: filename,
      path: `${dir}/${filename}.pgn`,
      numGames: 1,
      metadata: metadata as any,
      lastModified: Math.floor(Date.now() / 1000),
    });
  } catch (e) {
    return Result.err(Error(String(e)));
  }
}
