import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTreeStore } from "@/state/store/tree";
import { saveToFile, type Tab } from "./tabs";
import { defaultTree } from "./treeReducer";

const { writeDbGame } = vi.hoisted(() => ({
    writeDbGame:
        vi.fn<
            (database: string, gameId: number, pgn: string) => Promise<{ status: "ok"; data: null }>
        >(),
}));
vi.mock("@/bindings", () => ({ commands: { writeDbGame } }));
vi.mock("@/utils/sound", () => ({ playSound: vi.fn<() => void>() }));

function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const tab: Tab = {
    name: "Database game",
    value: "game-tab",
    type: "analysis",
    gameOrigin: { kind: "database", database: "/test/copy.duckdb", gameId: 43 },
};

function setup() {
    const initial = defaultTree();
    initial.headers = {
        ...initial.headers,
        event: "",
        date: "1963.03.??",
        other: { ECO: "C52" },
    };
    const store = createTreeStore(undefined, initial);
    store.getState().setHeaders(initial.headers);
    const save = (isUserSave = false) =>
        saveToFile({
            dir: "/unused",
            tab,
            setTabs: vi.fn<Parameters<typeof saveToFile>[0]["setTabs"]>(),
            store,
            isUserSave,
        });
    return { store, save };
}

beforeEach(() => {
    writeDbGame.mockReset();
});

describe("database saves", () => {
    it("persists edits made during a pending write before marking the game clean", async () => {
        const first = deferred();
        const second = deferred();
        let persisted = "";
        writeDbGame
            .mockImplementationOnce(async (_database, _id, pgn) => {
                await first.promise;
                persisted = pgn;
                return { status: "ok", data: null };
            })
            .mockImplementationOnce(async (_database, _id, pgn) => {
                await second.promise;
                persisted = pgn;
                return { status: "ok", data: null };
            });
        const { store, save } = setup();
        const pending = save();
        expect(writeDbGame.mock.calls[0][2]).toContain('[Event "?"]');
        store.getState().setHeaders({ ...store.getState().headers, event: "New York [edited]" });
        first.resolve();
        await vi.waitFor(() => expect(writeDbGame).toHaveBeenCalledTimes(2));
        expect(store.getState().dirty).toBe(true);
        expect(persisted).toContain('[Event "?"]');
        second.resolve();
        await expect(pending).resolves.toBe(true);
        expect(persisted).toContain('[Event "New York [edited]"]');
        expect(persisted).toContain('[Date "1963.03.??"]');
        expect(persisted).toContain('[ECO "C52"]');
        expect(store.getState().dirty).toBe(false);
    });

    it("coalesces overlapping automatic and explicit saves and drains later tree edits in order", async () => {
        const writes = [deferred(), deferred(), deferred()];
        let active = 0;
        let peakActive = 0;
        let persisted = "";
        writeDbGame.mockImplementation(async (_database, _id, pgn) => {
            const write = writes[writeDbGame.mock.calls.length - 1];
            peakActive = Math.max(peakActive, ++active);
            await write.promise;
            persisted = pgn;
            active--;
            return { status: "ok", data: null };
        });
        const { store, save } = setup();
        const automatic = save();
        store.getState().setHeaders({ ...store.getState().headers, event: "Latest event" });
        const explicit = save(true);
        expect(writeDbGame).toHaveBeenCalledTimes(1);
        writes[0].resolve();
        await vi.waitFor(() => expect(writeDbGame).toHaveBeenCalledTimes(2));
        store.getState().setComment("Comment edited during the second write");
        writes[1].resolve();
        await vi.waitFor(() => expect(writeDbGame).toHaveBeenCalledTimes(3));
        expect(store.getState().dirty).toBe(true);
        writes[2].resolve();
        await expect(Promise.all([automatic, explicit])).resolves.toEqual([true, true]);
        expect(peakActive).toBe(1);
        expect(persisted).toContain('[Event "Latest event"]');
        expect(persisted).toContain("Comment edited during the second write");
        expect(store.getState().dirty).toBe(false);
    });

    it("leaves failed writes dirty and permits a fresh retry", async () => {
        writeDbGame.mockRejectedValueOnce(new Error("write failed"));
        const { store, save } = setup();
        await expect(save()).rejects.toThrow("write failed");
        expect(store.getState().dirty).toBe(true);
        writeDbGame.mockResolvedValueOnce({ status: "ok", data: null });
        await expect(save(true)).resolves.toBe(true);
        expect(writeDbGame).toHaveBeenCalledTimes(2);
        expect(store.getState().dirty).toBe(false);
    });
});
