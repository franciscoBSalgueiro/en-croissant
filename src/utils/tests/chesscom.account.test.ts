import { notifications } from "@mantine/notifications";
import { fetch } from "@tauri-apps/plugin-http";
import type { error, info } from "@tauri-apps/plugin-log";
import type { getDatabasesDir } from "../directories";
import { beforeEach, expect, test, vi } from "vitest";
import { getChessComAccount, getStats } from "../chess.com/api";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn<typeof fetch>() }));
vi.mock("@tauri-apps/plugin-log", () => ({
    error: vi.fn<typeof error>(),
    info: vi.fn<typeof info>(),
}));
vi.mock("../directories", () => ({ getDatabasesDir: vi.fn<typeof getDatabasesDir>() }));

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(notifications, "show").mockImplementation(() => "test-notification");
});

const performance = {
    last: { rating: 1017, date: 1779278089 },
    record: { win: 1, loss: 0, draw: 0 },
};

for (const [field, label] of [
    ["chess_daily", "Daily"],
    ["chess_rapid", "Rapid"],
    ["chess_blitz", "Blitz"],
    ["chess_bullet", "Bullet"],
] as const) {
    test.each([undefined, 75])(`${field} accepts rating deviation %s`, async (rd) => {
        const stats = {
            [field]: {
                ...performance,
                last: { ...performance.last, ...(rd === undefined ? {} : { rd }) },
            },
        };
        vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(stats)));
        const account = await getChessComAccount("TestPlayer");
        expect(account).toEqual(stats);
        expect(getStats(account!)).toEqual([{ value: 1017, label }]);
        expect(fetch).toHaveBeenCalledWith("https://api.chess.com/pub/player/testplayer/stats", {
            method: "GET",
            headers: { "User-Agent": expect.any(String) },
        });
        expect(notifications.show).not.toHaveBeenCalled();
    });
}

test.each([{ ...performance.last, rd: "unknown" }, { date: performance.last.date }])(
    "invalid required or present fields still reject the account",
    async (last) => {
        vi.mocked(fetch).mockResolvedValue(
            new Response(JSON.stringify({ chess_rapid: { ...performance, last } })),
        );
        expect(await getChessComAccount("TestPlayer")).toBeNull();
        expect(notifications.show).toHaveBeenCalledOnce();
    },
);

test("an unsuccessful HTTP response still rejects the account", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Not found", { status: 404 }));
    expect(await getChessComAccount("TestPlayer")).toBeNull();
    expect(notifications.show).toHaveBeenCalledOnce();
});
