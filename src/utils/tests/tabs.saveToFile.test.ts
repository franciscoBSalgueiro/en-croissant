import { notifications } from "@mantine/notifications";
import { save } from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";
import { error } from "@tauri-apps/plugin-log";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { commands } from "@/bindings";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import { getPGN } from "@/utils/chess";
import { saveToFile, type Tab } from "@/utils/tabs";

vi.mock("@mantine/notifications", () => ({
    notifications: { show: vi.fn<typeof notifications.show>() },
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn<typeof save>() }));
vi.mock("@tauri-apps/plugin-fs", { spy: true });
vi.mock("@tauri-apps/plugin-log", () => ({
    error: vi.fn<typeof error>().mockResolvedValue(undefined),
}));

let store: TreeStore;

beforeEach(() => {
    store = createTreeStore();
    store.getState().setHeaders({ ...store.getState().headers, white: "White", black: "Black" });
    store.getState().setComment("Unsaved analysis");
    vi.spyOn(commands, "writeGame");
    vi.spyOn(commands, "writeDbGame");
});

afterEach(() => {
    // No persistence ID, subscriptions or timers are attached to this store.
    store.getState().reset();
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

describe.each(["file", "temp_file"] as const)("saveToFile with %s origin", (kind) => {
    const tab: Tab = {
        name: "Analysis",
        value: "save-test",
        type: "analysis",
        gameOrigin: {
            kind,
            gameNumber: 2,
            file: {
                type: "file",
                name: "analysis.pgn",
                path: "/games/analysis.pgn",
                numGames: 3,
                metadata: { tags: [], type: "game" },
                lastModified: 0,
            },
        },
    };

    function saveGame() {
        const setCurrentTab = vi.fn<Parameters<typeof saveToFile>[0]["setCurrentTab"]>();
        const promise = saveToFile({ dir: "/games", tab, setCurrentTab, store });
        return { promise, setCurrentTab };
    }

    function expectWrite() {
        const { root, headers } = store.getState();
        const pgn = `${getPGN(root, {
            headers,
            comments: true,
            extraMarkups: true,
            glyphs: true,
            variations: true,
        })}\n\n`;
        expect(pgn).toContain("Unsaved analysis");
        expect(pgn).toContain('[White "White"]');
        expect(commands.writeGame).toHaveBeenCalledWith("/games/analysis.pgn", 2, pgn);
        expect(save).not.toHaveBeenCalled();
        expect(fs.copyFile).not.toHaveBeenCalled();
        expect(commands.writeDbGame).not.toHaveBeenCalled();
    }

    test("reports a native error, rejects and retains the dirty tree", async () => {
        const write = Promise.withResolvers<Awaited<ReturnType<typeof commands.writeGame>>>();
        vi.mocked(commands.writeGame).mockReturnValueOnce(write.promise);
        const before = store.getState();
        const { promise, setCurrentTab } = saveGame();
        expect(store.getState().dirty).toBe(true);
        expectWrite();

        write.resolve({ status: "error", error: "Permission denied" });
        await expect.soft(promise).rejects.toThrow("Permission denied");
        expect.soft(store.getState()).toEqual(before);
        expect.soft(store.getState().dirty).toBe(true);
        expect(setCurrentTab).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledExactlyOnceWith("Permission denied");
        expect(notifications.show).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ title: "Error", message: "Permission denied", color: "red" }),
        );
    });

    test("clears dirty only after a confirmed native write", async () => {
        const write = Promise.withResolvers<Awaited<ReturnType<typeof commands.writeGame>>>();
        vi.mocked(commands.writeGame).mockReturnValueOnce(write.promise);
        const { root, headers } = store.getState();
        const { promise, setCurrentTab } = saveGame();
        await Promise.resolve();
        expect(store.getState().dirty).toBe(true);
        expectWrite();

        write.resolve({ status: "ok", data: null });
        await expect(promise).resolves.toBeUndefined();
        expect(store.getState().dirty).toBe(false);
        expect(store.getState().root).toBe(root);
        expect(store.getState().headers).toBe(headers);
        expect(setCurrentTab).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
        expect(notifications.show).not.toHaveBeenCalled();
    });

    test("can retry the retained dirty tree after a native error", async () => {
        vi.mocked(commands.writeGame)
            .mockResolvedValueOnce({ status: "error", error: "Disk full" })
            .mockResolvedValueOnce({ status: "ok", data: null });
        await expect(saveGame().promise).rejects.toThrow("Disk full");
        expect(store.getState().dirty).toBe(true);
        const firstWrite = vi.mocked(commands.writeGame).mock.calls[0];

        await expect(saveGame().promise).resolves.toBeUndefined();
        expect(commands.writeGame).toHaveBeenCalledTimes(2);
        expect(vi.mocked(commands.writeGame).mock.calls[1]).toEqual(firstWrite);
        expectWrite();
        expect(store.getState().dirty).toBe(false);
        expect(error).toHaveBeenCalledExactlyOnceWith("Disk full");
        expect(notifications.show).toHaveBeenCalledTimes(1);
    });

    test("preserves transport rejection identity and dirty state", async () => {
        const transportError = new Error("Native transport unavailable");
        vi.mocked(commands.writeGame).mockRejectedValueOnce(transportError);
        const before = store.getState();
        const { promise, setCurrentTab } = saveGame();

        await expect(promise).rejects.toBe(transportError);
        expect(store.getState()).toEqual(before);
        expect(store.getState().dirty).toBe(true);
        expectWrite();
        expect(setCurrentTab).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
        expect(notifications.show).not.toHaveBeenCalled();
    });
});
