import type { MantineColor } from "@mantine/core";
import { parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import equal from "fast-deep-equal";
import { atom, type PrimitiveAtom } from "jotai";
import {
  atomFamily,
  atomWithStorage,
  createJSONStorage,
  loadable,
} from "jotai/utils";
import type { AtomFamily } from "jotai/vanilla/utils/atomFamily";
import type {
  AsyncStorage,
  SyncStorage,
} from "jotai/vanilla/utils/atomWithStorage";
import type { ReviewLog } from "ts-fsrs";
import { z } from "zod";
import type { BestMoves, GoMode } from "@/bindings";
import {
  DEFAULT_TIME_CONTROL,
  type OpponentSettings,
} from "@/components/boards/OpponentForm";
import { type Position, positionSchema } from "@/components/files/opening";
import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import { positionFromFen, swapMove } from "@/utils/chessops";
import type { SuccessDatabaseInfo } from "@/utils/db";
import {
  type Engine,
  type EngineSettings,
  engineSchema,
} from "@/utils/engines";
import {
  type LichessGamesOptions,
  lichessGamesOptionsSchema,
  type MasterGamesOptions,
  masterOptionsSchema,
} from "@/utils/lichess/explorer";
import { getWinChance, normalizeScore } from "@/utils/score";
import { genID, type Tab, tabSchema } from "@/utils/tabs";
import type { Session } from "../utils/session";
import { createAsyncZodStorage, createZodStorage, fileStorage } from "./utils";

const zodArray = <Input, Output>(
  itemSchema: z.ZodType<Output, z.ZodTypeDef, Input>,
) => {
  const catchValue = {} as never;

  const res = z
    .array(itemSchema.catch(catchValue))
    .transform((a) => a.filter((o): o is Output => o !== catchValue))
    .catch([]);

  return res as z.ZodType<Output[], z.ZodTypeDef, Input[]>;
};

export const enginesAtom = atomWithStorage<Engine[]>(
  "engines/engines.json",
  [],
  createAsyncZodStorage(zodArray(engineSchema), fileStorage) as AsyncStorage<
    Engine[]
  >,
);

const loadableEnginesAtom = loadable(enginesAtom);

// Tabs

const firstTab: Tab = {
  name: "New Tab",
  value: genID(),
  type: "new",
};

export const tabsAtom = atomWithStorage<Tab[]>(
  "tabs",
  [firstTab],
  createZodStorage(z.array(tabSchema), sessionStorage),
);

export const activeTabAtom = atomWithStorage<string | null>(
  "activeTab",
  firstTab.value,
  createJSONStorage(() => sessionStorage),
);

export const currentTabAtom = atom(
  (get) => {
    const tabs = get(tabsAtom);
    const activeTab = get(activeTabAtom);
    return tabs.find((tab) => tab.value === activeTab);
  },
  (get, set, newValue: Tab | ((currentTab: Tab) => Tab)) => {
    const tabs = get(tabsAtom);
    const activeTab = get(activeTabAtom);
    const nextValue =
      typeof newValue === "function"
        ? newValue(get(currentTabAtom)!)
        : newValue;
    const newTabs = tabs.map((tab) => {
      if (tab.value === activeTab) {
        return nextValue;
      }
      return tab;
    });
    set(tabsAtom, newTabs);
  },
);

// Directories
export const storedDocumentDirAtom = atomWithStorage<string>(
  "document-dir",
  "",
  undefined,
  { getOnInit: true },
);

// Settings

export const tableViewAtom = atomWithStorage<boolean>("table-view", false);

export const fontSizeAtom = atomWithStorage(
  "font-size",
  Number.parseInt(document.documentElement.style.fontSize) || 100,
);

export const moveNotationTypeAtom = atomWithStorage<"letters" | "symbols">(
  "letters",
  "symbols",
);
export const moveMethodAtom = atomWithStorage<"drag" | "select" | "both">(
  "move-method",
  "both",
);
export const spellCheckAtom = atomWithStorage<boolean>("spell-check", false);
export const moveInputAtom = atomWithStorage<boolean>("move-input", false);
export const showDestsAtom = atomWithStorage<boolean>("show-dests", true);
export const moveHighlightAtom = atomWithStorage<boolean>(
  "move-highlight",
  true,
);
export const snapArrowsAtom = atomWithStorage<boolean>("snap-dests", true);
export const showArrowsAtom = atomWithStorage<boolean>("show-arrows", true);
export const showConsecutiveArrowsAtom = atomWithStorage<boolean>(
  "show-consecutive-arrows",
  false,
);
export const eraseDrawablesOnClickAtom = atomWithStorage<boolean>(
  "erase-drawables-on-click",
  false,
);
export const autoPromoteAtom = atomWithStorage<boolean>("auto-promote", true);
export const autoSaveAtom = atomWithStorage<boolean>("auto-save", true);
export const previewBoardOnHoverAtom = atomWithStorage<boolean>(
  "preview-board-on-hover",
  true,
);
export const enableBoardScrollAtom = atomWithStorage<boolean>(
  "board-scroll",
  true,
);
export const forcedEnPassantAtom = atomWithStorage<boolean>("forced-ep", false);
export const showCoordinatesAtom = atomWithStorage<"no" | "edge" | "all">(
  "show-coordinates-v2",
  "no",
  undefined,
  { getOnInit: true },
);
export const soundCollectionAtom = atomWithStorage<string>(
  "sound-collection",
  "standard",
  undefined,
  {
    getOnInit: true,
  },
);

export const soundVolumeAtom = atomWithStorage<number>(
  "sound-volume",
  0.8,
  undefined,
  {
    getOnInit: true,
  },
);

export const pieceSetAtom = atomWithStorage<string>("piece-set", "staunty");
export const boardImageAtom = atomWithStorage<string>(
  "board-image",
  "gray.svg",
);
export const primaryColorAtom = atomWithStorage<MantineColor>(
  "mantine-primary-color",
  "blue",
);
export const sessionsAtom = atomWithStorage<Session[]>("sessions", []);
export const nativeBarAtom = atomWithStorage<boolean>("native-bar", false);
export const telemetryEnabledAtom = atomWithStorage<boolean>(
  "telemetry-enabled",
  true,
  undefined,
  { getOnInit: true },
);

// Recent Files

export type RecentFile = {
  name: string;
  path: string;
  type: "game" | "repertoire" | "tournament" | "puzzle" | "other";
  lastOpened: number;
};

const MAX_RECENT_FILES = 10;

export const recentFilesAtom = atomWithStorage<RecentFile[]>(
  "recent-files",
  [],
);

export const addRecentFileAtom = atom(
  null,
  (get, set, file: Omit<RecentFile, "lastOpened">) => {
    const current = get(recentFilesAtom);
    const filtered = current.filter((f) => f.path !== file.path);
    const updated = [{ ...file, lastOpened: Date.now() }, ...filtered].slice(
      0,
      MAX_RECENT_FILES,
    );
    set(recentFilesAtom, updated);
  },
);

// Database

export const referenceDbAtom = atomWithStorage<string | null>(
  "reference-database",
  null,
);

export const selectedPuzzleDbAtom = atomWithStorage<string | null>(
  "puzzle-db",
  null,
);

export const selectedDatabaseAtom = atomWithStorage<SuccessDatabaseInfo | null>(
  "database-view",
  null,
  createJSONStorage(() => sessionStorage),
);

// Game Settings

export type GameInputColor = "white" | "random" | "black";

export const gameInputColorAtom = atomWithStorage<GameInputColor>(
  "game-input-color",
  "white",
);

const defaultPlayerSettings: OpponentSettings = {
  type: "human",
  name: "Player",
  timeControl: DEFAULT_TIME_CONTROL,
  timeUnit: "m",
  incrementUnit: "s",
};
export const gamePlayer1SettingsAtom = atomWithStorage<OpponentSettings>(
  "game-player1-settings",
  defaultPlayerSettings,
);

export const gamePlayer2SettingsAtom = atomWithStorage<OpponentSettings>(
  "game-player2-settings",
  defaultPlayerSettings,
);

export const gameSameTimeControlAtom = atomWithStorage<boolean>(
  "game-same-time-control",
  true,
);

function tabValue<
  T extends object | string | boolean | number | null | undefined,
>(family: AtomFamily<string, PrimitiveAtom<T>>) {
  return atom(
    (get) => {
      const tab = get(currentTabAtom);
      if (!tab) throw new Error("No tab selected");
      const atom = family(tab.value);
      return get(atom);
    },
    (get, set, newValue: T | ((currentValue: T) => T)) => {
      const tab = get(currentTabAtom);
      if (!tab) throw new Error("No tab selected");
      const nextValue =
        typeof newValue === "function"
          ? newValue(get(tabValue(family)))
          : newValue;
      const atom = family(tab.value);
      set(atom, nextValue);
    },
  );
}

// Puzzles
export const hidePuzzleRatingAtom = atomWithStorage<boolean>(
  "hide-puzzle-rating",
  false,
);
export const progressivePuzzlesAtom = atomWithStorage<boolean>(
  "progressive-puzzles",
  false,
);
export const jumpToNextPuzzleAtom = atomWithStorage<boolean>(
  "puzzle-jump-immediately",
  true,
);
export const puzzleRatingRangeAtom = atomWithStorage<[number, number]>(
  "puzzle-ratings",
  [1000, 1500],
);

export const puzzleThemeAtom = atomWithStorage<string | null>(
  "puzzle-theme",
  null,
);

export const coverageMinGamesAtom = atomWithStorage<number>(
  "coverage-min-games",
  50,
);

export const puzzleTimerFamily = atomFamily((tab: string) =>
  atom<number | null>(null),
);
export const currentPuzzleTimerAtom = tabValue(puzzleTimerFamily);

// CP / WDL

export const reportTypeAtom = atom<"CP" | "WDL">("CP");

export const scoreTypeFamily = atomFamily((engine: string) =>
  atom<"cp" | "wdl">("cp"),
);

// Per tab settings

const threatFamily = atomFamily((tab: string) => atom(false));
export const currentThreatAtom = tabValue(threatFamily);

const evalOpenFamily = atomFamily((tab: string) => atom(true));
export const currentEvalOpenAtom = tabValue(evalOpenFamily);

const evalBarDisplayFamily = atomFamily((tab: string) =>
  atom<"cp" | "wdl">("cp"),
);
export const currentEvalBarDisplayAtom = tabValue(evalBarDisplayFamily);

const invisibleFamily = atomFamily((tab: string) => atom(false));
export const currentInvisibleAtom = tabValue(invisibleFamily);

export const tabFamily = atomFamily((tab: string) => atom("info"));
export const currentTabSelectedAtom = tabValue(tabFamily);
export const annotationFocusAtom = atom(0);
export const triggerAnnotationFocusAtom = atom(null, (_, set) => {
  set(annotationFocusAtom, (n) => n + 1);
});

const localOptionsFamily = atomFamily((tab: string) =>
  atom<LocalOptions>({
    path: null,
    type: "exact",
    fen: "",
    player: null,
    color: "white",
    result: "any",
  }),
);
export const currentLocalOptionsAtom = tabValue(localOptionsFamily);

export const lichessOptionsAtom = atomWithStorage<LichessGamesOptions>(
  "lichess-all-options",
  {
    ratings: [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500],
    speeds: ["bullet", "blitz", "rapid", "classical", "correspondence"],
    color: "white",
  },
  createZodStorage(lichessGamesOptionsSchema, localStorage),
  {
    getOnInit: true,
  },
);

export const masterOptionsAtom = atomWithStorage<MasterGamesOptions>(
  "lichess-master-options",
  {},
  createZodStorage(masterOptionsSchema, localStorage),
  {
    getOnInit: true,
  },
);

const dbTypeFamily = atomFamily((tab: string) =>
  atom<"local" | "lch_all" | "lch_master">("local"),
);
export const currentDbTypeAtom = tabValue(dbTypeFamily);

const dbTabFamily = atomFamily((tab: string) => atom("stats"));
export const currentDbTabAtom = tabValue(dbTabFamily);

const analysisTabFamily = atomFamily((tab: string) => atom("engines"));
export const currentAnalysisTabAtom = tabValue(analysisTabFamily);

const practiceTabFamily = atomFamily((tab: string) => atom("train"));
export const currentPracticeTabAtom = tabValue(practiceTabFamily);

const expandedEnginesFamily = atomFamily((tab: string) =>
  atom<string[] | undefined>(undefined),
);
export const currentExpandedEnginesAtom = tabValue(expandedEnginesFamily);

export const currentDetachedEngineAtom = atomWithStorage<string | null>(
  "detached-engine",
  null,
);

const pgnOptionsFamily = atomFamily((tab: string) =>
  atom({
    comments: true,
    glyphs: true,
    variations: true,
    extraMarkups: true,
  }),
);
export const currentPgnOptionsAtom = tabValue(pgnOptionsFamily);

const currentPuzzleFamily = atomFamily((tab: string) => atom(0));
export const currentPuzzleAtom = tabValue(currentPuzzleFamily);

// Game

type GameState = "settingUp" | "playing" | "gameOver";
const gameStateFamily = atomFamily((tab: string) =>
  atom<GameState>("settingUp"),
);
export const currentGameStateAtom = tabValue(gameStateFamily);

const playersFamily = atomFamily((tab: string) =>
  atom<{
    white: OpponentSettings;
    black: OpponentSettings;
  }>({ white: {} as OpponentSettings, black: {} as OpponentSettings }),
);
export const currentPlayersAtom = tabValue(playersFamily);

const gameIdFamily = atomFamily((tab: string) => atom<string | null>(null));
export const currentGameIdAtom = tabValue(gameIdFamily);

// Practice

const reviewLogSchema = z
  .object({
    fen: z.string(),
  })
  .passthrough();

const practiceDataSchema = z.object({
  positions: positionSchema.array(),
  logs: reviewLogSchema.array(),
});

export type PracticeData = {
  positions: Position[];
  logs: (ReviewLog & { fen: string })[];
};

export const deckAtomFamily = atomFamily(
  ({ file, game }: { file: string; game: number }) =>
    atomWithStorage<PracticeData>(
      `deck-${file}-${game}`,
      {
        positions: [],
        logs: [],
      },
      createZodStorage(
        practiceDataSchema,
        localStorage,
      ) as any as SyncStorage<PracticeData>, // TODO: fix types
    ),

  (a, b) => a.file === b.file && a.game === b.game,
);

export type PracticePhase =
  | "idle" // Not practicing
  | "waiting" // Waiting for user to make a move
  | "correct" // Move was correct, waiting for quality rating
  | "incorrect"; // Move was incorrect, showing feedback

export type PracticeState = {
  phase: PracticePhase;
  currentFen?: string;
  answer?: string;
  playedMove?: string;
  timeTaken?: number;
  positionIndex?: number;
};

export const practiceStateFamily = atomFamily((tab: string) =>
  atom<PracticeState>({ phase: "idle" }),
);
export const practiceStateAtom = tabValue(practiceStateFamily);

export type PracticeSessionStats = {
  correct: number;
  incorrect: number;
  streak: number;
  bestStreak: number;
};

const practiceSessionStatsFamily = atomFamily((tab: string) =>
  atom<PracticeSessionStats>({
    correct: 0,
    incorrect: 0,
    streak: 0,
    bestStreak: 0,
  }),
);
export const practiceSessionStatsAtom = tabValue(practiceSessionStatsFamily);

const practiceCardStartTimeFamily = atomFamily((tab: string) =>
  atom<number>(0),
);
export const practiceCardStartTimeAtom = tabValue(practiceCardStartTimeFamily);

export const engineMovesFamily = atomFamily(
  ({ tab, engine }: { tab: string; engine: string }) =>
    atom<Map<string, BestMoves[]>>(new Map()),
  (a, b) => a.tab === b.tab && a.engine === b.engine,
);

export const engineProgressFamily = atomFamily(
  ({ tab, engine }: { tab: string; engine: string }) => atom<number>(0),
  (a, b) => a.tab === b.tab && a.engine === b.engine,
);

// returns the best moves of each engine for the current position
export const bestMovesFamily = atomFamily(
  ({ fen, gameMoves }: { fen: string; gameMoves: string[] }) =>
    atom<Map<number, { pv: string[]; winChance: number }[]>>((get) => {
      const tab = get(activeTabAtom);
      if (!tab) return new Map();
      const engines = get(loadableEnginesAtom);
      if (!(engines.state === "hasData")) return new Map();
      const bestMoves = new Map<
        number,
        { pv: string[]; winChance: number }[]
      >();
      let n = 0;
      for (const engine of engines.data.filter((e) => e.loaded)) {
        const engineMoves = get(engineMovesFamily({ tab, engine: engine.id }));
        const [pos] = positionFromFen(fen);
        let finalFen = INITIAL_FEN;
        if (pos) {
          for (const move of gameMoves) {
            const m = parseUci(move);
            pos.play(m!);
          }
          finalFen = makeFen(pos.toSetup());
        }
        const moves =
          engineMoves.get(`${swapMove(finalFen)}:`) ||
          engineMoves.get(`${fen}:${gameMoves.join(",")}`);
        if (moves && moves.length > 0) {
          const bestWinChange = getWinChance(
            normalizeScore(moves[0].score.value, pos?.turn || "white"),
          );
          bestMoves.set(
            n,
            moves.reduce<{ pv: string[]; winChance: number }[]>((acc, m) => {
              const winChance = getWinChance(
                normalizeScore(m.score.value, pos?.turn || "white"),
              );
              if (bestWinChange - winChance < 10) {
                acc.push({ pv: m.uciMoves, winChance });
              }
              return acc;
            }, []),
          );
        }
        n++;
      }
      return bestMoves;
    }),
  (a, b) => a.fen === b.fen && equal(a.gameMoves, b.gameMoves),
);

export const firstEngineWithLinesFamily = atomFamily(
  ({ fen, gameMoves }: { fen: string; gameMoves: string[] }) =>
    atom<string | null>((get) => {
      const tab = get(activeTabAtom);
      if (!tab) return null;
      const engines = get(loadableEnginesAtom);
      if (!(engines.state === "hasData")) return null;

      const [pos] = positionFromFen(fen);
      let finalFen = INITIAL_FEN;
      if (pos) {
        for (const move of gameMoves) {
          const m = parseUci(move);
          if (m) pos.play(m);
        }
        finalFen = makeFen(pos.toSetup());
      }

      for (const engine of engines.data.filter((e) => e.loaded)) {
        const engineMoves = get(engineMovesFamily({ tab, engine: engine.id }));
        const moves =
          engineMoves.get(`${swapMove(finalFen)}:`) ||
          engineMoves.get(`${fen}:${gameMoves.join(",")}`);

        if (moves && moves.length > 0) {
          return engine.id;
        }
      }
      return null;
    }),
  (a, b) => a.fen === b.fen && equal(a.gameMoves, b.gameMoves),
);

export const tabEngineSettingsFamily = atomFamily(
  ({
    tab,
    engineId,
    defaultSettings,
    defaultGo,
  }: {
    tab: string;
    engineId: string;
    defaultSettings?: EngineSettings;
    defaultGo?: GoMode;
  }) => {
    return atom<{
      enabled: boolean;
      settings: EngineSettings;
      go: GoMode;
      synced: boolean;
    }>({
      enabled: false,
      settings: defaultSettings || [],
      go: defaultGo || { t: "Infinite" },
      synced: true,
    });
  },
  (a, b) => a.tab === b.tab && a.engineId === b.engineId,
);

export const allEnabledAtom = loadable(
  atom(async (get) => {
    const engines = await get(enginesAtom);

    const v = engines
      .filter((e) => e.loaded)
      .every((engine) => {
        const atom = tabEngineSettingsFamily({
          tab: get(activeTabAtom)!,
          engineId: engine.id,
          defaultSettings:
            engine.type === "local" ? engine.settings || [] : undefined,
          defaultGo: engine.go ?? undefined,
        });
        return get(atom).enabled;
      });

    return v;
  }),
);

export const enableAllAtom = atom(null, (get, set, value: boolean) => {
  const engines = get(loadableEnginesAtom);
  if (!(engines.state === "hasData")) return;

  for (const engine of engines.data.filter((e) => e.loaded)) {
    const atom = tabEngineSettingsFamily({
      tab: get(activeTabAtom)!,
      engineId: engine.id,
      defaultSettings:
        engine.type === "local" ? engine.settings || [] : undefined,
      defaultGo: engine.go ?? undefined,
    });
    set(atom, { ...get(atom), enabled: value });
  }
});
