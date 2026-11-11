import { writeTextFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { expect, test, vi } from "vitest";
import { downloadChessCom } from "../chess.com/api";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn<typeof fetch>() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: vi.fn<typeof writeTextFile>() }));
vi.mock("@tauri-apps/plugin-log", () => ({
    info: vi.fn<(message: string) => Promise<void>>(),
    error: vi.fn<(message: string) => Promise<void>>(),
}));
vi.mock("@tauri-apps/api/path", () => ({
    resolve: async (...parts: string[]) => parts.join("/"),
}));
vi.mock("../directories", () => ({ getDatabasesDir: async () => "/databases" }));
vi.mock("@/bindings", () => ({
    events: { progressEvent: { emit: vi.fn<() => Promise<void>>() } },
}));

// A game as Chess.com's monthly archive lists it; the Event header names what kind of game it is
function archiveGame(kind: string, timeControl: string, rated: boolean, rules: string) {
    return {
        url: `https://www.chess.com/game/${kind}`,
        pgn: `[Event "${kind}"]\n\n1. e4 e5 *\n`,
        time_control: timeControl,
        end_time: 1760000000,
        rated,
        initial_setup: "",
        fen: "",
        rules,
        white: { rating: 1500, result: "win", username: "white" },
        black: { rating: 1500, result: "resigned", username: "black" },
    };
}

test("a Chess.com download keeps the same games as a Lichess one: rated standard games only", async () => {
    // The account's total adds up the rated records of daily, rapid, blitz and bullet, so the
    // download has to keep exactly those games for "downloaded / total" to mean anything
    const month = [
        archiveGame("rated blitz", "180", true, "chess"),
        archiveGame("unrated blitz", "180", false, "chess"),
        archiveGame("rated Chess960", "180", true, "chess960"),
        archiveGame("rated daily", "1/86400", true, "chess"),
        archiveGame("unrated daily", "1/86400", false, "chess"),
    ];
    vi.mocked(fetch).mockImplementation(
        async (input) =>
            ({
                json: async () =>
                    input.toString().endsWith("/archives")
                        ? { archives: ["https://api.chess.com/pub/player/someone/games/2026/10"] }
                        : { games: month },
            }) as Response,
    );

    await downloadChessCom("someone", null);

    // Everything written to the PGN file the importer then reads
    const written = vi
        .mocked(writeTextFile)
        .mock.calls.map(([, text]) => text)
        .join("");
    expect(written.match(/\[Event "[^"]*"\]/g)).toEqual([
        '[Event "rated blitz"]',
        // Daily games count like Lichess correspondence games, which the Lichess download keeps
        '[Event "rated daily"]',
    ]);
});
