import { expect, test, vi } from "vitest";
import { createTab, getAccountGameOrientation } from "../tabs";
import { defaultTree, type GameHeaders } from "../treeReducer";

// parsePGN needs the Rust backend; these tests are only about the headers createTab stores
vi.mock("../chess", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../chess")>()),
    parsePGN: async () => (await import("../treeReducer")).defaultTree(),
}));

test("your games as Black in an account database open from Black's side", () => {
    expect(
        getAccountGameOrientation("/dbs/MagnusFan_lichess.db3", {
            white: "Rival",
            black: "MagnusFan",
        }),
    ).toBe("black");
    expect(
        getAccountGameOrientation("/dbs/MagnusFan_chesscom.db3", {
            white: "Rival",
            black: "MagnusFan",
        }),
    ).toBe("black");
});

test("your games as White in an account database keep White at the bottom", () => {
    expect(
        getAccountGameOrientation("/dbs/MagnusFan_lichess.db3", {
            white: "MagnusFan",
            black: "Rival",
        }),
    ).toBeUndefined();
});

test("the account name is matched case-insensitively", () => {
    // The file is named with the username as typed when adding the account,
    // while the games use the platform's canonical casing.
    expect(
        getAccountGameOrientation("/dbs/magnusfan_chesscom.db3", {
            white: "Rival",
            black: "MagnusFan",
        }),
    ).toBe("black");
});

test("games in databases that aren't account downloads are left alone", () => {
    expect(
        getAccountGameOrientation("/dbs/Caissabase 2024.db3", {
            white: "Rival",
            black: "MagnusFan",
        }),
    ).toBeUndefined();
    // Containing a username isn't enough: only the account download naming counts
    expect(
        getAccountGameOrientation("/dbs/MagnusFan games.db3", {
            white: "Rival",
            black: "MagnusFan",
        }),
    ).toBeUndefined();
});

test("an account name matching neither player or both players keeps White at the bottom", () => {
    expect(
        getAccountGameOrientation("/dbs/MagnusFan_lichess.db3", { white: "Rival", black: "Other" }),
    ).toBeUndefined();
    expect(
        getAccountGameOrientation("/dbs/MagnusFan_lichess.db3", {
            white: "MagnusFan",
            black: "magnusfan",
        }),
    ).toBeUndefined();
});

test("usernames with underscores and Windows paths are recognized", () => {
    expect(
        getAccountGameOrientation("C:\\Users\\me\\AppData\\Roaming\\db\\some_player_lichess.db3", {
            white: "Rival",
            black: "Some_Player",
        }),
    ).toBe("black");
});

async function openFromDatabase(database: string, headers: GameHeaders) {
    const id = await createTab({
        tab: { name: "game", type: "analysis" },
        setTabs: () => {},
        setActiveTab: () => {},
        pgn: "1. e4 e5 *",
        headers,
        gameOrigin: { kind: "database", database, gameId: 1 },
    });
    return JSON.parse(sessionStorage.getItem(id)!).state.headers;
}

test("opening your Black game from an account database starts with Black at the bottom", async () => {
    const headers = { ...defaultTree().headers, white: "Rival", black: "MagnusFan" };

    expect((await openFromDatabase("/dbs/MagnusFan_lichess.db3", headers)).orientation).toBe(
        "black",
    );
    // The database row passed in isn't modified
    expect(headers.orientation).toBeUndefined();
});

test("opening a game from a non-account database leaves its headers unchanged", async () => {
    const headers = { ...defaultTree().headers, white: "Rival", black: "MagnusFan" };

    expect(await openFromDatabase("/dbs/Caissabase 2024.db3", headers)).toEqual(headers);
});
