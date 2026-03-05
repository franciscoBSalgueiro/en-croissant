import { resolve, tempDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { copyFile } from "@tauri-apps/plugin-fs";
import { z } from "zod";
import type { StoreApi } from "zustand";
import { commands } from "@/bindings";
import { type FileMetadata, fileMetadataSchema } from "@/components/files/file";
import type { TreeStoreState } from "@/state/store/tree";
import { getPGN, parsePGN } from "./chess";
import { type GameHeaders, getGameName } from "./treeReducer";

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]+/g;

function getDefaultGameFilename(headers: GameHeaders) {
  const baseName = getGameName(headers).trim();
  const date = headers.date?.trim() || "";
  const hasUsableBase = baseName.length > 0 && baseName !== "Unknown";
  const hasUsableDate =
    Boolean(date) && date !== "????.??.??" && date !== "????.??";

  let filename = hasUsableBase ? baseName : "";
  if (hasUsableDate) {
    filename = filename ? `${date}_${filename}` : date;
  }

  filename = filename
    .replace(INVALID_FILENAME_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (filename.length > 0) {
    return filename;
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 16).replace(":", ".");
  return `${today}_${time}_analysis`;
}

const gameOriginSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("none"),
  }),
  z.object({
    kind: z.literal("file"),
    file: fileMetadataSchema,
    gameNumber: z.number(),
  }),
  z.object({
    kind: z.literal("temp_file"),
    file: fileMetadataSchema,
    gameNumber: z.number(),
  }),
]);

export const tabSchema = z.object({
  name: z.string(),
  value: z.string(),
  type: z.enum(["new", "play", "analysis", "puzzles"]),
  gameOrigin: gameOriginSchema,
});

export type GameOrigin = z.infer<typeof gameOriginSchema>;
export type Tab = z.infer<typeof tabSchema>;

export function getTabFile(tab?: Tab | null): FileMetadata | undefined {
  if (!tab) return undefined;
  if (tab.gameOrigin.kind === "file" || tab.gameOrigin.kind === "temp_file") {
    return tab.gameOrigin.file;
  }
  return undefined;
}

export function getTabGameNumber(tab?: Tab | null): number {
  if (!tab) return 0;
  if (tab.gameOrigin.kind === "file" || tab.gameOrigin.kind === "temp_file") {
    return tab.gameOrigin.gameNumber;
  }
  return 0;
}

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
  gameOrigin,
  position,
}: {
  tab: Omit<Tab, "value" | "gameOrigin">;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string | null>>;
  pgn?: string;
  headers?: GameHeaders;
  gameOrigin?: GameOrigin;
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
    const nextTab = {
      ...tab,
      value: id,
      gameOrigin: gameOrigin ?? { kind: "none" },
    };
    if (
      prev.length === 0 ||
      (prev.length === 1 && prev[0].type === "new" && tab.type !== "new")
    ) {
      return [nextTab];
    }
    return [...prev, nextTab];
  });
  setActiveTab(id);
  return id;
}

export async function isInTempDir(filePath: string): Promise<boolean> {
  const tmp = await tempDir();
  const normalize = (p: string) => p.replace(/[\\/]+/g, "/").toLowerCase();
  return normalize(filePath).startsWith(normalize(tmp));
}

export async function saveToFile({
  dir,
  tab,
  setCurrentTab,
  store,
  isUserSave,
}: {
  dir: string;
  tab: Tab | undefined;
  setCurrentTab: React.Dispatch<React.SetStateAction<Tab>>;
  store: StoreApi<TreeStoreState>;
  isUserSave?: boolean;
}) {
  let filePath: string;
  const currentOrigin = tab?.gameOrigin;
  const fileOrigin =
    currentOrigin?.kind === "file" || currentOrigin?.kind === "temp_file"
      ? currentOrigin
      : undefined;
  const isTempFile = currentOrigin?.kind === "temp_file";

  if (fileOrigin && !(isTempFile && isUserSave)) {
    filePath = fileOrigin.file.path;
  } else {
    const headers = store.getState().headers;
    const suggestedName = getDefaultGameFilename(headers) || "Game";
    const defaultPath = await resolve(dir, `${suggestedName}.pgn`);
    const userChoice = await save({
      defaultPath,
      filters: [
        {
          name: "PGN",
          extensions: ["pgn"],
        },
      ],
    });
    if (userChoice === null) {
      return;
    }
    if (userChoice.endsWith(".pgn")) {
      filePath = userChoice;
    } else {
      // on Linux filters for userChoice seemingly don't work
      // so userChoice can end without 'pgn' extension
      filePath = userChoice.concat(".pgn");
    }

    if (isTempFile && fileOrigin) {
      await copyFile(fileOrigin.file.path, filePath);
    }

    const numGames = isTempFile && fileOrigin ? fileOrigin.file.numGames : 1;
    const gameNumber = fileOrigin?.gameNumber ?? 0;
    setCurrentTab((prev) => {
      return {
        ...prev,
        gameOrigin: {
          kind: "file",
          gameNumber,
          file: {
            type: "file",
            name: filePath,
            path: filePath,
            numGames,
            metadata: {
              tags: [],
              type: "game",
            },
            lastModified: Date.now(),
          },
        },
      };
    });
  }
  await commands.writeGame(
    filePath,
    fileOrigin?.gameNumber ?? 0,
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
