import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { Tab, genID } from "../utils/tabs";
import { MantineColor } from "@mantine/core";
import { Session } from "../utils/session";
import { atom } from "jotai";
import { DatabaseInfo } from "@/utils/db";

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

export const minimumGamesAtom = atomWithStorage<number>("minimum-games", 5);
