import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { Tab, genID } from "../utils/tabs";

export const firstTab: Tab = {
    name: "New tab",
    value: genID(),
    type: "new",
};

export const activeTabAtom = atomWithStorage<string | null>(
    "activeTab",
    firstTab.value,
    createJSONStorage(() => sessionStorage)
);
