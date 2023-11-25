import { BestMoves, EngineOptions, GoMode } from "@/bindings";
import { Card, buildFromTree } from "@/components/files/opening";
import { LocalOptions } from "@/components/panels/database/DatabasePanel";
import { DatabaseInfo } from "@/utils/db";
import { Engine } from "@/utils/engines";
import {
    LichessGamesOptions,
    MasterGamesOptions,
} from "@/utils/lichess/lichessexplorer";
import { MissingMove } from "@/utils/repertoire";
import { Tab, genID } from "@/utils/tabs";
import { GameHeaders, TreeNode } from "@/utils/treeReducer";
import { MantineColor } from "@mantine/core";
import {
    BaseDirectory,
    readTextFile,
    removeFile,
    writeTextFile,
} from "@tauri-apps/api/fs";
import { PrimitiveAtom, atom } from "jotai";
import {
    atomFamily,
    atomWithStorage,
    createJSONStorage,
    loadable,
} from "jotai/utils";
import { AtomFamily } from "jotai/vanilla/utils/atomFamily";
import { AsyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";
import { Session } from "../utils/session";

const options = { dir: BaseDirectory.AppData };
const fileStorage: AsyncStringStorage = {
    async getItem(key) {
        try {
            return await readTextFile(key, options);
        } catch (error) {
            return null;
        }
    },
    async setItem(key, newValue) {
        await writeTextFile(key, newValue, options);
    },
    async removeItem(key) {
        await removeFile(key, options);
    },
};

export const enginesAtom = atomWithStorage<Engine[]>(
    "engines/engines.json",
    [],
    createJSONStorage(() => fileStorage)
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
    createJSONStorage(() => sessionStorage)
);

export const activeTabAtom = atomWithStorage<string | null>(
    "activeTab",
    firstTab.value,
    createJSONStorage(() => sessionStorage)
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
    }
);

// Settings

export const fontSizeAtom = atomWithStorage(
    "font-size",
    parseInt(document.documentElement.style.fontSize) || 100
);

export const moveInputAtom = atomWithStorage<boolean>("move-input", false);
export const showDestsAtom = atomWithStorage<boolean>("show-dests", true);
export const showArrowsAtom = atomWithStorage<boolean>("show-arrows", true);
export const autoPromoteAtom = atomWithStorage<boolean>("auto-promote", true);
export const autoSaveAtom = atomWithStorage<boolean>("auto-save", true);
export const forcedEnPassantAtom = atomWithStorage<boolean>("forced-ep", false);
export const showCoordinatesAtom = atomWithStorage<boolean>(
    "show-coordinates",
    false
);
export const pieceSetAtom = atomWithStorage<string>("piece-set", "staunty");
export const primaryColorAtom = atomWithStorage<MantineColor>(
    "mantine-primary-color",
    "blue"
);
export const sessionsAtom = atomWithStorage<Session[]>("sessions", []);

// Database

export const referenceDbAtom = atomWithStorage<string | null>(
    "reference-database",
    null
);

export const selectedDatabaseAtom = atomWithStorage<DatabaseInfo | null>(
    "database-view",
    null,
    createJSONStorage(() => sessionStorage)
);

// Opening Report

export const percentageCoverageAtom = atomWithStorage<number>(
    "percentage-coverage",
    95
);

type TabMap<T> = Record<string, T>;

export const minimumGamesAtom = atomWithStorage<number>("minimum-games", 5);

export const missingMovesAtom = atomWithStorage<TabMap<MissingMove[] | null>>(
    "missing-moves",
    {},
    createJSONStorage(() => sessionStorage)
);

function tabValue<T extends object | string | boolean>(
    family: AtomFamily<string, PrimitiveAtom<T>>
) {
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
        }
    );
}

// Per tab settings

const invisibleFamily = atomFamily((tab: string) => atom(false));
export const currentInvisibleAtom = tabValue(invisibleFamily);

const tabFamily = atomFamily((tab: string) => atom("info"));
export const currentTabSelectedAtom = tabValue(tabFamily);

const localOptionsFamily = atomFamily((tab: string) =>
    atom<LocalOptions>({
        path: null,
        type: "exact",
        fen: "",
    })
);
export const currentLocalOptionsAtom = tabValue(localOptionsFamily);

const lichessOptionsFamily = atomFamily((tab: string) =>
    atom<LichessGamesOptions>({
        fen: "",
        ratings: [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500],
        speeds: ["bullet", "blitz", "rapid", "classical", "correspondence"],
    })
);
export const currentLichessOptionsAtom = tabValue(lichessOptionsFamily);

const masterOptionsFamily = atomFamily((tab: string) =>
    atom<MasterGamesOptions>({
        fen: "",
    })
);
export const currentMasterOptionsAtom = tabValue(masterOptionsFamily);

const dbTypeFamily = atomFamily((tab: string) =>
    atom<"local" | "lch_all" | "lch_master">("local")
);
export const currentDbTypeAtom = tabValue(dbTypeFamily);

const dbTabFamily = atomFamily((tab: string) => atom("stats"));
export const currentDbTabAtom = tabValue(dbTabFamily);

const analysisTabFamily = atomFamily((tab: string) => atom("engines"));
export const currentAnalysisTabAtom = tabValue(analysisTabFamily);

const pgnOptionsFamily = atomFamily((tab: string) =>
    atom({
        comments: true,
        annotations: true,
        variations: true,
        symbols: false,
    })
);
export const currentPgnOptionsAtom = tabValue(pgnOptionsFamily);

// Practice

const practicingFamily = atomFamily((tab: string) => atom(false));
export const currentPracticingAtom = tabValue(practicingFamily);

export const deckAtomFamily = atomFamily(
    ({
        id,
        game,
        root,
        headers,
    }: {
        id: string;
        game: number;
        root: TreeNode;
        headers: GameHeaders;
    }) => {
        const a = atomWithStorage<Card[]>(`deck-${id}-${game}`, []);
        a.onMount = (set) => {
            if (localStorage.getItem(`deck-${id}-${game}`) === null) {
                const cards = buildFromTree(
                    root,
                    headers.orientation || "white",
                    headers.start || []
                );
                set(cards);
            }
        };
        return a;
    },
    (a, b) => a.id === b.id && a.game === b.game
);

export type EngineSettings = {
    enabled: boolean;
    go: GoMode;
    options: Omit<EngineOptions, "fen">;
};

export const engineMovesFamily = atomFamily(
    ({ tab, engine }: { tab: string; engine: string }) =>
        atom<Map<string, BestMoves[]>>(new Map()),
    (a, b) => a.tab === b.tab && a.engine === b.engine
);

export const tabEngineSettingsFamily = atomFamily(
    ({ tab, engine }: { tab: string; engine: string }) => {
        const savedDefault = localStorage.getItem(`engine-${engine}`);
        return atom<EngineSettings>(
            savedDefault !== null
                ? ({
                      ...JSON.parse(savedDefault),
                      enabled: false,
                  } as EngineSettings)
                : {
                      enabled: false,
                      go: {
                          t: "Depth",
                          c: 24,
                      },
                      options: {
                          threads: 2,
                          multipv: 3,
                          hash: 16,
                          extraOptions: [],
                      },
                  }
        );
    },
    (a, b) => a.tab === b.tab && a.engine === b.engine
);

export const allEnabledAtom = loadable(
    atom(async (get) => {
        const engines = await get(enginesAtom);

        const v = engines
            .filter((e) => e.loaded)
            .every((engine) => {
                const atom = tabEngineSettingsFamily({
                    tab: get(activeTabAtom)!,
                    engine: engine.name,
                });
                return get(atom).enabled;
            });

        return v;
    })
);

export const enableAllAtom = atom(null, (get, set, value: boolean) => {
    const engines = get(loadableEnginesAtom);
    if (!(engines.state === "hasData")) return;

    for (const engine of engines.data.filter((e) => e.loaded)) {
        const atom = tabEngineSettingsFamily({
            tab: get(activeTabAtom)!,
            engine: engine.name,
        });
        set(atom, { ...get(atom), enabled: value });
    }
});
