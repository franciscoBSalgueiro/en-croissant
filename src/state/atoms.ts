import type { DatabaseInfo, GoMode } from "@/bindings";
import type { Bot } from "@/utils/bots";
import { botSchema } from "@/utils/bots";
import type { Player } from "@/utils/players";
import { playerSchema } from "@/utils/players";
import { type Position, positionSchema } from "@/components/files/opening";
import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import {
  type Engine,
  type EngineSettings,
  engineSchema,
} from "@/utils/engines";
import {
  type LichessGamesOptions,
  type MasterGamesOptions,
  lichessGamesOptionsSchema,
  masterOptionsSchema,
} from "@/utils/lichess/explorer";
import type { MissingMove } from "@/utils/repertoire";
import { type Tab, genID, tabSchema } from "@/utils/tabs";
import type { MantineColor } from "@mantine/core";

import type { OpponentSettings } from "@/components/boards/types";
import { positionFromFen, swapMove } from "@/utils/chessops";
import type { SuccessDatabaseInfo } from "@/utils/db";
import { saveEngines } from "@/utils/engines";
import { getWinChance, normalizeScore } from "@/utils/score";
import { info, warn } from "@tauri-apps/plugin-log";
import { parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import equal from "fast-deep-equal";
import { type PrimitiveAtom, atom } from "jotai";
import {
  atomFamily,
  atomWithStorage,
  createJSONStorage,
  loadable,
} from "jotai/utils";
import type { AtomFamily } from "jotai/vanilla/utils/atomFamily";
import type { SyncStorage } from "jotai/vanilla/utils/atomWithStorage";
import type { ReviewLog } from "ts-fsrs";
import { z } from "zod";
import type { Session } from "../utils/session";
import { createZodStorage, createAsyncZodStorage, dataStoreStorage } from "./utils";
import type { BestMoves } from "@/bindings";

export const lastMovedAtom = atom<string | null>(null);

const zodArray = <S>(itemSchema: z.ZodType<S>) => {
  const catchValue = {} as never;

  const res = z
    .array(itemSchema.catch(catchValue))
    .transform((a) => a.filter((o) => o !== catchValue))
    .catch([]);

  return res as z.ZodType<S[]>;
};

export const enginesAtom = atomWithStorage<Engine[]>(
  "engines",
  [],
  createAsyncZodStorage(zodArray(engineSchema), dataStoreStorage),
);

// Bots
export const botsAtom = atomWithStorage<Bot[]>(
  "bots",
  [],
  createAsyncZodStorage(z.array(botSchema), dataStoreStorage),
);

export const loadableEnginesAtom = loadable(enginesAtom);

// Players
export const playersAtom = atomWithStorage<Player[]>(
  "players",
  [
    { id: "human", name: "Human", elo: 1500, earnedELO: 1500 } as Player,
  ],
  createAsyncZodStorage(z.array(playerSchema), dataStoreStorage),
);

export const defaultPlayerIdAtom = atomWithStorage<string>(
  "default-player-id",
  "human",
  createAsyncZodStorage(z.string(), dataStoreStorage),
);

// Write-through persistence: ensure disk file is updated whenever enginesAtom changes
export const persistEnginesAtom = atom(
  null,
  async (get, set, _update: Engine[]) => {
    const engines = await get(enginesAtom);
    try {
      await saveEngines(engines);
      await info(`persistEnginesAtom: saved ${engines.length} engine(s)`);
    } catch (e) {
      warn(`persistEnginesAtom: failed to save engines: ${e}`);
    }
  },
);

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
export const snapArrowsAtom = atomWithStorage<boolean>("snap-dests", true);
export const showArrowsAtom = atomWithStorage<boolean>("show-arrows", true);
export const showConsecutiveArrowsAtom = atomWithStorage<boolean>(
  "show-consecutive-arrows",
  false,
);
export const arrowColorModeAtom = atomWithStorage<"engine" | "quality" | "pctBest">(
  "arrow-color-mode",
  "pctBest",
  createZodStorage(z.enum(["engine", "quality", "pctBest"]), localStorage),
);
export const arrowEmphasisModeAtom = atomWithStorage<"rank" | "uniform">(
  "arrow-emphasis-mode",
  "rank",
  createZodStorage(z.enum(["rank", "uniform"]), localStorage),
);
export const arrowColorMeaningAtom = atomWithStorage<"rank" | "score" | "pctBest" | "uniform">(
  "arrow-color-meaning",
  "pctBest",
  createZodStorage(z.enum(["rank", "score", "pctBest", "uniform"]), localStorage),
);
export const arrowOpacityMeaningAtom = atomWithStorage<"rank" | "score" | "pctBest" | "uniform">(
  "arrow-opacity-meaning",
  "rank",
  createZodStorage(z.enum(["rank", "score", "pctBest", "uniform"]), localStorage),
);
export const arrowSizeMeaningAtom = atomWithStorage<"rank" | "score" | "pctBest" | "uniform">(
  "arrow-size-meaning",
  "rank",
  createZodStorage(z.enum(["rank", "score", "pctBest", "uniform"]), localStorage),
);
export const arrowCountPolicyAtom = atomWithStorage<"alwaysTopN" | "threshold">(
  "arrow-count-policy",
  "threshold",
  createZodStorage(z.enum(["alwaysTopN", "threshold"]), localStorage),
);
export const arrowBestThresholdAtom = atomWithStorage<number>(
  "arrow-best-threshold",
  10,
);
// Arrow rendering customization
export const arrowOpacityAtom = atomWithStorage<number>(
  "arrow-opacity",
  0.6,
  undefined,
  { getOnInit: true },
);
export const arrowSizeScaleAtom = atomWithStorage<number>(
  "arrow-size-scale",
  1,
  undefined,
  { getOnInit: true },
);
export const eraseDrawablesOnClickAtom = atomWithStorage<boolean>(
  "erase-drawables-on-click",
  false,
);
export const autoPromoteAtom = atomWithStorage<boolean>("auto-promote", true);
export const autoSaveAtom = atomWithStorage<boolean>("auto-save", true);
export const autoStartAnalysisAtom = atomWithStorage<boolean>("auto-start-analysis", true);
export const previewBoardOnHoverAtom = atomWithStorage<boolean>(
  "preview-board-on-hover",
  true,
);
export const enableBoardScrollAtom = atomWithStorage<boolean>(
  "board-scroll",
  true,
);
export const forcedEnPassantAtom = atomWithStorage<boolean>("forced-ep", false);
export const showCoordinatesAtom = atomWithStorage<boolean>(
  "show-coordinates",
  true,
  undefined,
  {
    getOnInit: true,
  },
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
// gchessboard theme (square colors). Use key of predefined theme map or 'auto'
export const gboardThemeAtom = atomWithStorage<string>(
  "gboard-theme",
  "wikipedia",
);
export const primaryColorAtom = atomWithStorage<MantineColor>(
  "mantine-primary-color",
  "blue",
);
export const sessionsAtom = atomWithStorage<Session[]>("sessions", []);
export const nativeBarAtom = atomWithStorage<boolean>("native-bar", false);

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

// Opening Report

export const percentageCoverageAtom = atomWithStorage<number>(
  "percentage-coverage",
  95,
);

type TabMap<T> = Record<string, T>;

export const minimumGamesAtom = atomWithStorage<number>("minimum-games", 5);

export const missingMovesAtom = atomWithStorage<TabMap<MissingMove[] | null>>(
  "missing-moves",
  {},
  createJSONStorage(() => sessionStorage),
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

const invisibleFamily = atomFamily((tab: string) => atom(false));
export const currentInvisibleAtom = tabValue(invisibleFamily);



const localOptionsFamily = atomFamily((tab: string) =>
  atom<LocalOptions>({
    path: null,
    type: "exact",
    fen: "",
    player: null,
    color: "white",
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

// Add a per-tab flag to pause/resume the game engine
const enginePausedFamily = atomFamily((tab: string) => atom(false));
export const currentEnginePausedAtom = tabValue(enginePausedFamily);

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
  ({
    file,
    game,
  }: {
    file: string;
    game: number;
  }) =>
    atomWithStorage<PracticeData>(
      `deck-${file}-${game}`,
      {
        positions: [],
        logs: [],
      },
      createAsyncZodStorage(
        practiceDataSchema,
        dataStoreStorage,
      ) as any as SyncStorage<PracticeData>,
    ),

  (a, b) => a.file === b.file && a.game === b.game,
);

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
      const policy = get(arrowCountPolicyAtom);
      const threshold = get(arrowBestThresholdAtom);
      const bestMoves = new Map<
        number,
        { pv: string[]; winChance: number }[]
      >();
      let n = 0;
      for (const engine of engines.data.filter((e) => e.loaded)) {
        const engineMoves = get(
          engineMovesFamily({ tab, engine: engine.name }),
        );
        // Get engine settings to find MultiPV
        const engineSettings = get(
          tabEngineSettingsFamily({
            tab,
            engineName: engine.name,
            defaultSettings: engine.settings ?? undefined,
            defaultGo: engine.go ?? undefined,
          }),
        );
        const multiPvLimit = Number.parseInt(
          engineSettings.settings.find((s) => s.name === "MultiPV")?.value?.toString() ?? "5"
        );
        const [pos] = positionFromFen(fen);
        let finalFen = INITIAL_FEN;
        if (pos) {
          for (const move of gameMoves) {
            const m = parseUci(move);
            pos.play(m!);
          }
          finalFen = makeFen(pos.toSetup());
        }
        // Always use top-n moves for arrows (never all-legal-moves data)
        const moves =
          engineMoves.get(`${swapMove(finalFen)}:`) ||
          engineMoves.get(`${fen}:${gameMoves.join(",")}`);
        if (moves && moves.length > 0) {
          const bestWinChange = getWinChance(
            normalizeScore(moves[0].score.value, pos?.turn || "white"),
          );
          // Use all moves up to MultiPV limit for arrows (filtered by policy)
          const truncated = moves.slice(0, Math.min(moves.length, multiPvLimit));
          const effectiveMoves = policy === "alwaysTopN"
            ? truncated
            : truncated.filter((m) => {
                const w = getWinChance(
                  normalizeScore(m.score.value, pos?.turn || "white"),
                );
                return (bestWinChange - w) < threshold;
              });
          bestMoves.set(
            n,
            effectiveMoves.reduce<{ pv: string[]; winChance: number }[]>((acc, m) => {
              const winChance = getWinChance(
                normalizeScore(m.score.value, pos?.turn || "white"),
              );
              acc.push({ pv: m.uciMoves, winChance });
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

export const tabEngineSettingsFamily = atomFamily(
  ({
    tab,
    engineName,
    defaultSettings,
    defaultGo,
  }: {
    tab: string;
    engineName: string;
    defaultSettings?: EngineSettings;
    defaultGo?: GoMode;
  }) => {
    const defaultThreads =
      typeof navigator !== "undefined" && (navigator as any).hardwareConcurrency && (navigator as any).hardwareConcurrency > 1
        ? 2
        : 1;
    // Merge desired defaults over engine-reported defaults
    const base: EngineSettings = Array.isArray(defaultSettings)
      ? [...defaultSettings]
      : [];
    const ensure = (name: string, minValue: number) => {
      const idx = base.findIndex((s) => s.name === name);
      if (idx >= 0) {
        const v = Number(base[idx].value ?? 0);
        if (!Number.isFinite(v) || v < minValue) base[idx] = { name, value: minValue } as any;
      } else {
        base.push({ name, value: minValue } as any);
      }
    };
    ensure("MultiPV", 5);
    ensure("Threads", defaultThreads);
    const mergedDefaultSettings: EngineSettings = base;
    return atom<{
      enabled: boolean;
      settings: EngineSettings;
      go: GoMode;
      synced: boolean;
      allMoves: boolean;
      useCache: boolean;
    }>({
      enabled: false,
      settings: mergedDefaultSettings,
      go: defaultGo || ({ t: "Depth", c: 24 } as any),
      synced: true,
      allMoves: true,
      useCache: false,
    });
  },
  (a, b) => a.tab === b.tab && a.engineName === b.engineName,
);

export const allEnabledAtom = loadable(
  atom(async (get) => {
    const engines = await get(enginesAtom);

    const v = engines
      .filter((e) => e.loaded)
      .every((engine) => {
        const atom = tabEngineSettingsFamily({
          tab: get(activeTabAtom)!,
          engineName: engine.name,
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
      engineName: engine.name,
      defaultSettings:
        engine.type === "local" ? engine.settings || [] : undefined,
      defaultGo: engine.go ?? undefined,
    });
    set(atom, { ...get(atom), enabled: value });
  }
});

// Bot suggestion: current chosen first move visualization per tab
type BotSuggestion = { from: string; to: string } | null;
const botSuggestionFamily = atomFamily((tab: string) => atom<BotSuggestion>(null));
export const currentBotSuggestionAtom = tabValue(botSuggestionFamily);

// Game History
export type HistoryEntry = {
  white: string;
  black: string;
  whiteElo?: number | null;
  blackElo?: number | null;
  result?: string;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  moves?: number;
  date?: string; // ISO timestamp
  time?: string | null;
  pgn: string;
  unifiedMainline?: any[]; // stored snapshot of unified/played move data for later analysis
};

export const historyAtom = atomWithStorage<HistoryEntry[]>(
  "history-entries",
  [],
  createAsyncZodStorage(z.array(z.any()), dataStoreStorage) as any,
);
