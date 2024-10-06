import { commands } from "@/bindings";
import { type FileMetadata, fileMetadataSchema } from "@/components/files/file";
import type { TreeStoreState } from "@/state/store";
import { save } from "@tauri-apps/plugin-dialog";
import { z } from "zod";
import type { StoreApi } from "zustand";
import { getPGN, parsePGN } from "./chess";
import type { GameHeaders } from "./treeReducer";

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

  if (pgn !== undefined) {
    const tree = await parsePGN(pgn, headers?.fen);
    if (headers) {
      tree.headers = headers;
      if (position) {
        tree.position = position;
      }
    }
    sessionStorage.setItem(id, JSON.stringify({ version: 0, state: tree }));
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
  dir,
  tab,
  setCurrentTab,
  store,
}: {
  dir: string;
  tab: Tab | undefined;
  setCurrentTab: React.Dispatch<React.SetStateAction<Tab>>;
  store: StoreApi<TreeStoreState>;
}) {
  let filePath: string;
  if (tab?.file) {
    filePath = tab.file.path;
  } else {
    const userChoice = await save({
      defaultPath: dir,
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
          type: "file",
          name: userChoice,
          path: userChoice,
          numGames: 1,
          metadata: {
            tags: [],
            type: "game",
          },
          lastModified: Date.now(),
        },
      };
    });
  }
  await commands.writeGame(
    filePath,
    tab?.gameNumber || 0,
    `${getPGN(store.getState().root, {
      headers: store.getState().headers,
      comments: true,
      extraMarkups: true,
      glyphs: true,
      variations: true,
    })}\n\n`,
  );
  store.getState().save();
}
