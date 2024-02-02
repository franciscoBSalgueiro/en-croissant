import { platform } from "@tauri-apps/api/os";
import useSWR from "swr";
import { match } from "ts-pattern";
import { parsePGN } from "./chess";
import { count_pgn_games, read_games } from "./db";
import { Tab, createTab } from "./tabs";
import { getGameName } from "./treeReducer";

export function usePlatform() {
  const r = useSWR("os", async () => {
    const p = await platform();
    const os = match(p)
      .with("win32", () => "windows" as const)
      .with("linux", () => "linux" as const)
      .with("darwin", () => "macos" as const)
      .otherwise(() => {
        throw Error("OS not supported");
      });
    return os;
  });
  return { os: r.data, ...r };
}

export async function openFile(
  file: string,
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  setActiveTab: React.Dispatch<React.SetStateAction<string | null>>,
) {
  const count = await count_pgn_games(file);
  const input = (await read_games(file, 0, 0))[0];

  const fileInfo = {
    metadata: {
      tags: [],
      type: "game" as const,
    },
    name: file,
    path: file,
    numGames: count,
  };
  const tree = await parsePGN(input);
  createTab({
    tab: {
      name: `${getGameName(tree.headers)} (Imported)`,
      type: "analysis",
    },
    setTabs,
    setActiveTab,
    pgn: input,
    fileInfo,
  });
}
