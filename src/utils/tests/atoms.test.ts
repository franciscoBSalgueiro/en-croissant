import { createStore } from "jotai";
import { beforeEach, expect, test, vi } from "vitest";
import { defaultPanelTabAtom, tabFamily } from "@/state/atoms";

beforeEach(() => {
    localStorage.clear();
});

test("a new game or analysis board opens on the tab chosen in Settings", () => {
    const store = createStore();
    // Info until the user chooses another tab, as before the setting existed
    expect(store.get(tabFamily("board-1"))).toBe("info");

    store.set(defaultPanelTabAtom, "database");

    expect(store.get(tabFamily("board-2"))).toBe("database");
});

test("the chosen tab is remembered, so boards open on it after a restart", async () => {
    createStore().set(defaultPanelTabAtom, "analysis");

    // Restarting loads the app's state again
    vi.resetModules();
    const restarted = await import("@/state/atoms");

    // Read on load, so the first board doesn't show Info before switching
    expect(createStore().get(restarted.tabFamily("board"))).toBe("analysis");
});

test("a repertoire still opens on Practice, whatever the setting", () => {
    const store = createStore();
    store.set(defaultPanelTabAtom, "database");
    // What opening a repertoire does
    store.set(tabFamily("repertoire"), "practice");

    store.set(defaultPanelTabAtom, "analysis");

    expect(store.get(tabFamily("repertoire"))).toBe("practice");
});

test("a board keeps the tab picked in it when the setting changes", () => {
    const store = createStore();
    store.set(tabFamily("board"), "annotate");

    store.set(defaultPanelTabAtom, "database");

    expect(store.get(tabFamily("board"))).toBe("annotate");
});
