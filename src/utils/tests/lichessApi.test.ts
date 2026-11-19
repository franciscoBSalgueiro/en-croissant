import { beforeEach, expect, test, vi } from "vitest";

const { downloadFile } = vi.hoisted(() => ({ downloadFile: vi.fn() }));

vi.mock("@/bindings", () => ({
    commands: { downloadFile },
}));
vi.mock("@tauri-apps/api/path", () => ({
    resolve: async (...parts: string[]) => parts.join("/"),
}));
vi.mock("../directories", () => ({
    getDatabasesDir: async () => "C:/databases",
}));

import { buildLichessGamesUrl, downloadLichess } from "../lichess/api";

beforeEach(() => {
    downloadFile.mockClear();
});

test("buildLichessGamesUrl does not filter by rated status", () => {
    const url = buildLichessGamesUrl("testuser", null);

    expect(url).toContain("/games/user/testuser?");
    expect(url).toContain("perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence");
    expect(url).toContain("sort=dateAsc");
    expect(url).not.toContain("rated=");
    expect(url).not.toContain("since=");
});

test("buildLichessGamesUrl includes since when a timestamp is provided", () => {
    const url = buildLichessGamesUrl("testuser", 1700000000000);

    expect(url).toContain("since=1700000000000");
    expect(url).not.toContain("rated=");
});

test("downloadLichess requests rated and casual games", async () => {
    await downloadLichess("testuser", 1700000000000, 10, () => {});

    expect(downloadFile).toHaveBeenCalledTimes(1);
    const url = downloadFile.mock.calls[0][1] as string;
    expect(url).not.toContain("rated=");
    expect(url).toContain("since=1700000000000");
});
