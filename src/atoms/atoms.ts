import { atomFamily, atomWithStorage, createJSONStorage } from "jotai/utils";
import { Tab, genID } from "../utils/tabs";
import { MantineColor } from "@mantine/core";
import { Session } from "../utils/session";
import { PrimitiveAtom, atom } from "jotai";
import { DatabaseInfo } from "@/utils/db";
import { MissingMove } from "@/utils/repertoire";
import { Card, buildFromTree } from "@/components/files/opening";
import { GameHeaders, TreeNode } from "@/utils/treeReducer";
import { AtomFamily } from "jotai/vanilla/utils/atomFamily";

// Tabs

const firstTab: Tab = {
    name: "New tab",
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
        return tabs.find((tab) => tab.value === activeTab)!;
    },
    (get, set, newValue: Tab | ((currentTab: Tab) => Tab)) => {
        const tabs = get(tabsAtom);
        const activeTab = get(activeTabAtom);
        const nextValue =
            typeof newValue === "function"
                ? newValue(get(currentTabAtom))
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

export const moveInputAtom = atomWithStorage<boolean>("move-input", false);
export const showDestsAtom = atomWithStorage<boolean>("show-dests", true);
export const showArrowsAtom = atomWithStorage<boolean>("show-arrows", true);
export const autoPromoteAtom = atomWithStorage<boolean>("auto-promote", true);
export const autoSaveAtom = atomWithStorage<boolean>("auto-save", true);
export const forcedEnPassantAtom = atomWithStorage<boolean>("forced-ep", false);
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


function tabValue<T extends object | string | boolean>(family: AtomFamily<string, PrimitiveAtom<T>>) {
    return atom(
        (get) => {
            const tab = get(currentTabAtom);
            const atom = family(tab.value);
            return get(atom);
        },
        (get, set, newValue: T | ((currentValue: T) => T)) => {
            const tab = get(currentTabAtom);
            const nextValue =
                typeof newValue === "function"
                    ? newValue(get(tabValue(family)))
                    : newValue;
            const atom = family(tab.value);
            set(atom, nextValue);
        }
    )
}

// Board Options

const invisibleFamily = atomFamily((tab: string) => atom(false));
export const currentInvisibleAtom = tabValue(invisibleFamily);


// Practice

const practicingFamily = atomFamily((tab: string) => atom(false));
export const currentPracticingAtom = tabValue(practicingFamily);

export const deckAtomFamily = atomFamily(
    ({ id, root, headers }: { id: string, root: TreeNode, headers: GameHeaders }) => {
        const a = atomWithStorage<Card[]>(`deck-${id}`, []);
        a.onMount = (set) => {
            if (localStorage.getItem(`deck-${id}`) === null) {
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
    (a, b) => a.id === b.id
);
