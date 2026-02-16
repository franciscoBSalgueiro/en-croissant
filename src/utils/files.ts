import { Result } from "@badrap/result";
import { resolve } from "@tauri-apps/api/path";
import { exists, writeTextFile } from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import { defaultGame, makePgn } from "chessops/pgn";
import { getDefaultStore } from "jotai";
import useSWR from "swr";
import { commands } from "@/bindings";
import type { FileMetadata } from "@/components/files/file";
import { addRecentFileAtom, tabFamily } from "@/state/atoms";
import { unwrap } from "@/utils/unwrap";
import { parsePGN } from "./chess";
import { createTab, type Tab } from "./tabs";
import { getGameName } from "./treeReducer";

export function usePlatform() {
  const r = useSWR("os", async () => {
    return platform();
  });
  return { os: r.data, ...r };
}

export async function openFile(
  file: string | FileMetadata,
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  setActiveTab: React.Dispatch<React.SetStateAction<string | null>>,
  options?: {
    gameNumber?: number;
    pgn?: string;
  },
) {
  const store = getDefaultStore();
  const gameNumber = options?.gameNumber ?? 0;
  let fileInfo: FileMetadata;
  let pgn = options?.pgn;
  let tabName = "Untitled";
  let recentName = "Untitled";

  if (typeof file === "string") {
    const count = unwrap(await commands.countPgnGames(file));
    if (pgn === undefined) {
      pgn = unwrap(await commands.readGames(file, gameNumber, gameNumber))[0];
    }

    fileInfo = {
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

    if (pgn) {
      const tree = await parsePGN(pgn);
      tabName = getGameName(tree.headers);
      recentName = tabName;
    } else {
      tabName = file;
      recentName = file;
    }
  } else {
    fileInfo = file;
    if (pgn === undefined) {
      pgn = unwrap(
        await commands.readGames(file.path, gameNumber, gameNumber),
      )[0];
    }
    tabName = file.name || "Untitled";
    recentName = tabName;
  }

  const id = await createTab({
    tab: {
      name: tabName,
      type: "analysis",
    },
    setTabs,
    setActiveTab,
    pgn: pgn || "",
    fileInfo,
    gameNumber,
  });

  if (fileInfo.metadata.type === "repertoire") {
    store.set(tabFamily(id), "practice");
  }

  store.set(addRecentFileAtom, {
    name: recentName,
    path: fileInfo.path,
    type: fileInfo.metadata.type,
  });

  return id;
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
  const numGames = unwrap(await commands.countPgnGames(file));
  return Result.ok({
    type: "file",
    name: filename,
    path: file,
    numGames,
    metadata,
    lastModified: new Date().getUTCSeconds(),
  });
}
