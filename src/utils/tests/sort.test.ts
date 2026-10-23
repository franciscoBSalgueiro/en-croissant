import { expect, test } from "vitest";
import type { DatabaseInfo } from "@/bindings";
import type { Session } from "../session";
import { compareAccounts, sortDatabases, sortFileTypes } from "../sort";

const types = ["game", "repertoire", "tournament", "puzzle", "other"];

test("file types are in alphabetical order in the user's language, with Other always last", () => {
    const english = {
        game: "Game",
        repertoire: "Repertoire",
        tournament: "Tournament",
        puzzle: "Puzzle",
        other: "Other",
    };
    const german = {
        game: "Spiel",
        repertoire: "Repertoire",
        tournament: "Turnier",
        puzzle: "Puzzle",
        other: "Andere",
    };
    const sorted = (names: Record<string, string>) =>
        sortFileTypes(
            types,
            (type) => type,
            (type) => names[type],
        ).map((type) => names[type]);
    expect(sorted(english)).toEqual(["Game", "Puzzle", "Repertoire", "Tournament", "Other"]);
    // A game is a "Spiel" in German, so it comes after Repertoire; "Andere" stays last
    expect(sorted(german)).toEqual(["Puzzle", "Repertoire", "Spiel", "Turnier", "Andere"]);
});

const database = (title: string, filename: string): DatabaseInfo =>
    ({ type: "success", title, filename, file: `/dbs/${filename}` }) as DatabaseInfo;
const unreadable = (filename: string): DatabaseInfo => ({
    type: "error",
    filename,
    file: `/dbs/${filename}`,
    error: "can't be read",
    indexed: false,
});

test("databases are in order of their names, with the ones that can't be read at the end", () => {
    // The order they come from the disk in: by file name, which isn't what the page shows
    const fromDisk = [
        unreadable("a_broken.db3"),
        database("Zurich 1953", "b_zurich.db3"),
        database("Candidates", "c_candidates.db3"),
        unreadable("0_old.db3"),
    ];
    expect(sortDatabases(fromDisk).map((db) => db.filename)).toEqual([
        "c_candidates.db3",
        "b_zurich.db3",
        "0_old.db3",
        "a_broken.db3",
    ]);
});

const lichess = (username: string) => ({ lichess: { username } }) as Session;
const chessCom = (username: string) => ({ chessCom: { username } }) as Session;
const name = (s: Session) =>
    s.chessCom ? `chess.com ${s.chessCom.username}` : `lichess ${s.lichess?.username}`;

test("accounts are in order of username whatever their site, and Chess.com first for the same username", () => {
    const added = [lichess("magnus"), chessCom("anna"), lichess("anna"), chessCom("magnus")];
    expect([...added].sort(compareAccounts).map(name)).toEqual([
        "chess.com anna",
        "lichess anna",
        "chess.com magnus",
        "lichess magnus",
    ]);
});
