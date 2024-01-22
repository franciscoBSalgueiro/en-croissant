import { parsePGN } from "./chess";
import { count_pgn_games, read_games } from "./db";
import { Tab, createTab } from "./tabs";
import { getGameName } from "./treeReducer";

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
