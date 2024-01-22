import { FileMetadata, fileMetadataSchema } from "@/components/files/file";
import { save } from "@tauri-apps/api/dialog";
import { documentDir, resolve } from "@tauri-apps/api/path";
import { z } from "zod";
import { getPGN, parsePGN } from "./chess";
import { invoke } from "./invoke";
import { GameHeaders, TreeNode } from "./treeReducer";

export const tabSchema = z.object({
  name: z.string(),
  value: z.string(),
  type: z.enum(["new", "play", "analysis", "puzzles"]),
  gameNumber: z.number().nullish(),
  file: fileMetadataSchema.nullish(),
});

export type Tab = z.infer<typeof tabSchema>;

export function genID() {
  function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  }
  return S4() + S4();
}

export async function createTab({
  tab,
  setTabs,
  setActiveTab,
  pgn,
  headers,
  fileInfo,
  gameNumber,
  position,
}: {
  tab: Omit<Tab, "value">;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string | null>>;
  pgn?: string;
  headers?: GameHeaders;
  fileInfo?: FileMetadata;
  gameNumber?: number;
  position?: number[];
}) {
  const id = genID();

  if (pgn) {
    const tree = await parsePGN(pgn, headers?.fen);
    if (headers) {
      tree.headers = headers;
      if (position) {
        tree.position = position;
      }
    }
    sessionStorage.setItem(id, JSON.stringify(tree));
  }

  setTabs((prev) => {
    if (
      prev.length === 0 ||
      (prev.length === 1 && prev[0].type === "new" && tab.type !== "new")
    ) {
      return [
        {
          ...tab,
          value: id,
          file: fileInfo,
          gameNumber,
        },
      ];
    }
    return [
      ...prev,
      {
        ...tab,
        value: id,
        file: fileInfo,
        gameNumber,
      },
    ];
  });
  setActiveTab(id);
  return id;
}

export async function saveToFile({
  tab,
  root,
  headers,
  setCurrentTab,
  markAsSaved,
}: {
  tab: Tab | undefined;
  root: TreeNode;
  headers: GameHeaders;
  setCurrentTab: React.Dispatch<React.SetStateAction<Tab>>;
  markAsSaved: () => void;
}) {
  let filePath: string;
  if (tab?.file) {
    filePath = tab.file.path;
  } else {
    const defaultPath = await resolve(await documentDir(), "EnCroissant");
    const userChoice = await save({
      defaultPath,
      filters: [
        {
          name: "PGN",
          extensions: ["pgn"],
        },
      ],
    });
    if (userChoice === null) return;
    filePath = userChoice;
    setCurrentTab((prev) => {
      return {
        ...prev,
        file: {
          name: userChoice,
          path: userChoice,
          numGames: 1,
          metadata: {
            tags: [],
            type: "game",
          },
        },
      };
    });
  }
  await invoke("write_game", {
    file: filePath,
    n: tab?.gameNumber || 0,
    pgn: `${getPGN(root, {
      headers,
    })}\n\n`,
  });
  markAsSaved();
}
