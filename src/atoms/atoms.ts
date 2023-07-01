import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { Tab, genID } from "../utils/tabs";
import { MantineColor } from "@mantine/core";
import { Session } from "../utils/session";

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

// Settings

export const showDestsAtom = atomWithStorage<boolean>("show-dests", true);
export const showArrowsAtom = atomWithStorage<boolean>("show-arrows", true);
export const autoPromoteAtom = atomWithStorage<boolean>("auto-promote", true);
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
