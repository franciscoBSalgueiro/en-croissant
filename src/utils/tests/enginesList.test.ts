import { createStore } from "jotai";
import { expect, test, vi } from "vitest";
import { enginesAtom } from "@/state/atoms";

// The engines file, and whether reading it is still under way
let engineFile = "[]";
let readStillUnderWay = false;
vi.mock("@tauri-apps/plugin-fs", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@tauri-apps/plugin-fs")>()),
    readTextFile: () =>
        readStillUnderWay ? new Promise<string>(() => {}) : Promise.resolve(engineFile),
    writeTextFile: vi.fn<() => Promise<void>>(),
    exists: vi.fn<() => Promise<boolean>>(async () => true),
    mkdir: vi.fn<() => Promise<void>>(),
}));
vi.mock("@tauri-apps/api/path", () => ({
    resolve: async (...parts: string[]) => parts.join("/"),
}));
vi.mock("@/utils/directories", () => ({ getEnginesDir: async () => "/engines" }));

const stockfish = {
    type: "local",
    id: "stockfish",
    name: "Stockfish",
    version: "17",
    path: "/engines/stockfish",
    loaded: true,
};

test("an analysis tab opened later has the engines at once, rather than none while their file is read again", async () => {
    engineFile = JSON.stringify([stockfish]);
    const store = createStore();

    // The session's first analysis tab reads the file; closing it leaves nothing showing the engines
    const firstTab = store.sub(enginesAtom, () => {});
    await vi.waitFor(() => expect(store.get(enginesAtom)).toEqual([stockfish]));
    firstTab();

    // The next one reads the file again, which takes a moment
    readStillUnderWay = true;
    const nextTab = store.sub(enginesAtom, () => {});
    expect(store.get(enginesAtom)).toEqual([stockfish]);
    nextTab();
});
