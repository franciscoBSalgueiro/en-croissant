import { beforeEach, expect, test, vi } from "vitest";

const { existsMock } = vi.hoisted(() => ({
    existsMock: vi.fn<(path: string) => Promise<boolean>>(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
    exists: existsMock,
    mkdir: vi.fn<(path: string) => Promise<void>>(async () => {}),
}));

vi.mock("@tauri-apps/api/path", () => ({
    resolve: async (...parts: string[]) => parts.join("/"),
    appDataDir: async () => "/app-data/",
    documentDir: async () => "/documents/",
    homeDir: async () => "/home/",
}));

import { resolveEnginePath } from "../directories";

let files: Set<string>;

beforeEach(() => {
    files = new Set(["/engines/stockfish-16.exe"]);
    existsMock.mockReset();
    existsMock.mockImplementation(async (path: string) => files.has(path));
    localStorage.clear();
    localStorage.setItem("engines-dir", JSON.stringify("/engines"));
});

test("keeps an engine path that still exists", async () => {
    await expect(resolveEnginePath("/engines/stockfish-16.exe")).resolves.toBe(
        "/engines/stockfish-16.exe",
    );
});

test("finds an engine in the current engines directory when the stored path is stale", async () => {
    await expect(resolveEnginePath("/old-engines/stockfish-16.exe")).resolves.toBe(
        "/engines/stockfish-16.exe",
    );
});

test("handles windows separators in stale paths", async () => {
    await expect(resolveEnginePath("C:\\Users\\me\\old-engines\\stockfish-16.exe")).resolves.toBe(
        "/engines/stockfish-16.exe",
    );
});

test("returns the stored path when no engine with that name is installed", async () => {
    await expect(resolveEnginePath("/old-engines/komodo-dragon.exe")).resolves.toBe(
        "/old-engines/komodo-dragon.exe",
    );
});

test("treats a throwing exists check as a missing file", async () => {
    existsMock.mockImplementation(async (path: string) => {
        if (path === "C:\\invalid") throw new Error("os error 267");
        return files.has(path);
    });

    await expect(resolveEnginePath("C:\\invalid\\stockfish-16.exe")).resolves.toBe(
        "/engines/stockfish-16.exe",
    );
});
