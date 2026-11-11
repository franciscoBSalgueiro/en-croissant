import { beforeEach, expect, it, vi } from "vitest";
import { catalogVolumes } from "./fixtures/openingCatalog";
import {
    downloadOpeningCatalog,
    loadOpeningCatalog,
    OPENING_CATALOG_REVISION,
} from "../openingCatalogDownload";

const { fetch, readTextFile, writeTextFile, exists, mkdir } = vi.hoisted(() => ({
    fetch: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    readTextFile: vi.fn<(...args: unknown[]) => Promise<string>>(),
    writeTextFile: vi.fn<(...args: unknown[]) => Promise<void>>(),
    exists: vi.fn<(...args: unknown[]) => Promise<boolean>>(),
    mkdir: vi.fn<(...args: unknown[]) => Promise<void>>(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readTextFile, writeTextFile, exists, mkdir }));
vi.mock("@tauri-apps/api/path", () => ({
    appDataDir: async () => "/app-data",
    resolve: async (...parts: string[]) => parts.join("/"),
}));

beforeEach(() => {
    vi.resetAllMocks();
    exists.mockResolvedValue(true);
    writeTextFile.mockResolvedValue();
});

it("downloads all pinned volumes and caches only the completed catalog", async () => {
    for (const volume of catalogVolumes)
        fetch.mockResolvedValueOnce({ ok: true, text: async () => volume });
    const catalog = await downloadOpeningCatalog();
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(fetch.mock.calls[0][0]).toBe(
        `https://raw.githubusercontent.com/lichess-org/chess-openings/${OPENING_CATALOG_REVISION}/a.tsv`,
    );
    expect(catalog.openings.length).toBeGreaterThan(4);
    expect(JSON.parse(writeTextFile.mock.calls[0][1] as string).volumes).toEqual(catalogVolumes);
});

it("uses the saved catalog without making network requests", async () => {
    readTextFile.mockResolvedValue(
        JSON.stringify({ revision: OPENING_CATALOG_REVISION, volumes: catalogVolumes }),
    );
    expect((await loadOpeningCatalog())?.openings.length).toBeGreaterThan(4);
    expect(fetch).not.toHaveBeenCalled();
});

it("does not overwrite the cache when a download fails", async () => {
    fetch.mockResolvedValue({ ok: false, status: 503 });
    await expect(downloadOpeningCatalog()).rejects.toThrow("HTTP 503");
    expect(writeTextFile).not.toHaveBeenCalled();
});

it("allows missing, corrupted or outdated caches to be downloaded again", async () => {
    readTextFile.mockRejectedValueOnce(new Error("Missing file"));
    expect(await loadOpeningCatalog()).toBeNull();
    readTextFile.mockResolvedValueOnce("not json");
    expect(await loadOpeningCatalog()).toBeNull();
    readTextFile.mockResolvedValueOnce(
        JSON.stringify({ revision: "old", volumes: catalogVolumes }),
    );
    expect(await loadOpeningCatalog()).toBeNull();
});
