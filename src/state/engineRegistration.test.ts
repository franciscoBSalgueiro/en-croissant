import { createStore, Provider } from "jotai";
import { MantineProvider } from "@mantine/core";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import AddEngine from "@/components/engines/AddEngine";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { enginesAtom, registerInstalledEngineAtom } from "./atoms";
import { createAsyncZodStorage } from "./utils";
import type { LocalEngine } from "@/utils/engines";

const { writeTextFile, readTextFile } = vi.hoisted(() => ({
    writeTextFile: vi.fn<(path: string, contents: string) => Promise<void>>(),
    readTextFile: vi.fn<(path: string) => Promise<string>>(),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
    BaseDirectory: { AppData: 1 },
    writeTextFile,
    readTextFile,
    exists: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    mkdir: vi.fn<() => Promise<void>>(),
    remove: vi.fn<() => Promise<void>>(),
}));
vi.mock("@tauri-apps/plugin-log", () => ({ warn: vi.fn<() => void>() }));
vi.mock("@tauri-apps/api/path", () => ({
    resolve: async (...parts: string[]) => parts.join("/"),
    join: async (...parts: string[]) => parts.join("/"),
}));
vi.mock("@/utils/directories", () => ({ getEnginesDir: async () => "/engines" }));

vi.mock("@/bindings", () => ({
    commands: {
        downloadFile: async () => ({ status: "ok", data: null }),
        setFileAsExecutable: async () => ({ status: "ok", data: null }),
        getEngineConfig: async () => ({ status: "ok", data: { options: [] } }),
    },
}));
vi.mock("@/hooks/useProgress", () => ({
    useProgress: () => ({ progress: 0, finished: false, isActive: false, clear: () => {} }),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: () => {} } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/files", () => ({ usePlatform: () => ({ os: "linux" }) }));
vi.mock("@/components/engines/EngineForm", () => ({ default: () => null }));
vi.mock("@/utils/engines", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/utils/engines")>()),
    useDefaultEngines: () => ({
        defaultEngines: [
            {
                type: "local",
                id: "candidate",
                name: "Candidate",
                version: "1",
                path: "candidate",
                downloadLink: "https://example.com/candidate",
                downloadSize: 1024,
            },
        ],
    }),
}));

function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((success, failure) => {
        resolve = success;
        reject = failure;
    });
    return { promise, resolve, reject };
}
function engine(id: string): LocalEngine {
    return { type: "local", id, name: id, version: "", path: `/engines/${id}`, loaded: true };
}
const existing = engine("existing");
let unsubscribe: (() => void) | undefined;
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
    }));
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
    writeTextFile.mockReset().mockResolvedValue(undefined);
    readTextFile.mockResolvedValue(JSON.stringify([existing]));
});
afterEach(() => {
    unsubscribe?.();
    vi.unstubAllGlobals();
});
async function mountedStore() {
    const store = createStore();
    unsubscribe = store.sub(enginesAtom, () => {});
    await vi.waitFor(() => expect(store.get(enginesAtom)).toEqual([existing]));
    return store;
}

for (const method of ["setItem", "removeItem"] as const) {
    test(`async storage ${method} waits for and propagates persistence errors`, async () => {
        const write = deferred();
        const storage = createAsyncZodStorage(z.string(), {
            getItem: async () => null,
            setItem: () => write.promise,
            removeItem: () => write.promise,
        });
        const pending =
            method === "setItem" ? storage.setItem("key", "value") : storage.removeItem("key");
        let settled = false;
        void Promise.resolve(pending).then(
            () => {
                settled = true;
            },
            () => {
                settled = true;
            },
        );
        await Promise.resolve();
        expect(settled).toBe(false);
        const failure = new Error("disk write failed");
        const rejected = Promise.resolve(pending).catch((error: unknown) => error);
        write.reject(failure);
        expect(await rejected).toBe(failure);
    });
}

test("registration stays pending until the engine JSON write completes", async () => {
    const store = await mountedStore();
    const write = deferred();
    writeTextFile.mockImplementationOnce(() => write.promise);
    const pending = store.set(registerInstalledEngineAtom, engine("new"));
    let settled = false;
    void pending.then(() => {
        settled = true;
    });
    await vi.waitFor(() => expect(writeTextFile).toHaveBeenCalledOnce());
    expect(store.get(enginesAtom)?.map((entry) => entry.id)).toEqual(["existing", "new"]);
    expect(settled).toBe(false);
    write.resolve();
    await pending;
    expect(settled).toBe(true);
});

test("failed persistence removes only the attempted ID and waits for cleanup", async () => {
    const store = await mountedStore();
    const write = deferred();
    const cleanup = deferred();
    writeTextFile
        .mockImplementationOnce(() => write.promise)
        .mockResolvedValueOnce(undefined)
        .mockImplementationOnce(() => cleanup.promise);
    const pending = store.set(registerInstalledEngineAtom, engine("failed"));
    const failure = new Error("write failed");
    const rejected = Promise.resolve(pending).catch((error: unknown) => error);
    await vi.waitFor(() => expect(writeTextFile).toHaveBeenCalledOnce());
    // Another UI action can add a different engine while persistence is pending.
    await store.set(enginesAtom, async (previous) => [
        ...((await previous) ?? []),
        engine("other"),
    ]);
    write.reject(failure);
    await vi.waitFor(() => expect(writeTextFile).toHaveBeenCalledTimes(3));
    expect(store.get(enginesAtom)?.map((entry) => entry.id)).toEqual(["existing", "other"]);
    let settled = false;
    void pending.catch(() => {
        settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    cleanup.resolve();
    expect(await rejected).toBe(failure);
});

test("rollback write failures still remove the attempted engine from memory", async () => {
    const store = await mountedStore();
    const writeError = new Error("write failed");
    const cleanupError = new Error("cleanup failed");
    writeTextFile.mockRejectedValueOnce(writeError).mockRejectedValueOnce(cleanupError);
    await expect(store.set(registerInstalledEngineAtom, engine("failed"))).rejects.toMatchObject({
        errors: [writeError, cleanupError],
    });
    expect(store.get(enginesAtom)).toEqual([existing]);
    // A failed transaction cannot poison the queue or accumulate phantom IDs.
    await store.set(registerInstalledEngineAtom, engine("retry"));
    expect(store.get(enginesAtom)?.map((entry) => entry.id)).toEqual(["existing", "retry"]);
});

test("concurrent failed registrations serialize cleanup and preserve other entries", async () => {
    const store = await mountedStore();
    const first = deferred();
    const cleanup = deferred();
    writeTextFile
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => cleanup.promise)
        .mockRejectedValueOnce(new Error("second write failed"));
    const a = store.set(registerInstalledEngineAtom, engine("a"));
    const b = store.set(registerInstalledEngineAtom, engine("b"));
    const results = Promise.allSettled([a, b]);
    await vi.waitFor(() => expect(writeTextFile).toHaveBeenCalledOnce());
    first.reject(new Error("first write failed"));
    await vi.waitFor(() => expect(writeTextFile).toHaveBeenCalledTimes(2));
    expect(store.get(enginesAtom)).toEqual([existing]);
    cleanup.resolve();
    expect((await results).map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(store.get(enginesAtom)).toEqual([existing]);
    const lists = writeTextFile.mock.calls.map(([, contents]) =>
        JSON.parse(contents).map((entry: LocalEngine) => entry.id),
    );
    expect(lists).toEqual([["existing", "a"], ["existing"], ["existing", "b"], ["existing"]]);
});

for (const fails of [false, true]) {
    test(`engine install button waits for persistence (failure=${fails})`, async () => {
        const store = await mountedStore();
        const write = deferred();
        writeTextFile.mockImplementationOnce(() => write.promise);
        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        try {
            await act(async () =>
                root.render(
                    createElement(
                        Provider,
                        { store },
                        createElement(
                            MantineProvider,
                            {},
                            createElement(AddEngine, { opened: true, setOpened: () => {} }),
                        ),
                    ),
                ),
            );
            const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
                (button) => button.textContent === "Common.Install",
            )!;
            expect(button).toBeDefined();
            await act(async () => button.click());
            await vi.waitFor(() => expect(writeTextFile).toHaveBeenCalledOnce());
            // The real atom already contains the optimistic entry, but the UI
            // must keep showing a pending installation until the write settles.
            expect(store.get(enginesAtom)?.some((entry) => entry.name === "Candidate")).toBe(true);
            expect(button.disabled).toBe(true);
            expect(button.textContent).toContain("Common.Downloading");
            expect(button.textContent).not.toContain("Common.Installed");
            await act(async () => {
                if (fails) write.reject(new Error("disk full"));
                else write.resolve();
            });
            const finalLabel = fails ? "Common.Install" : "Common.Installed";
            const finalButton = () =>
                Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
                    (button) => button.textContent === finalLabel,
                );
            await vi.waitFor(() => expect(finalButton()).toBeDefined());
            expect(finalButton()!.disabled).toBe(!fails);
            expect(store.get(enginesAtom)?.some((entry) => entry.name === "Candidate")).toBe(
                !fails,
            );
        } finally {
            await act(async () => root.unmount());
            host.remove();
        }
    });
}
