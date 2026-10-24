import { expect, test } from "vitest";
import { type Session, splitAccountDatabases } from "../session";

const lichess = (username: string) =>
    ({ lichess: { username: username.toLowerCase(), account: { username } } }) as Session;
const chessCom = (username: string) => ({ chessCom: { username } }) as Session;
const db = (filename: string) => ({ filename });
const names = (databases: { filename: string }[]) => databases.map((d) => d.filename);

test("a linked account's databases are apart from the others, each in the page's order", () => {
    const page = [
        db("Caissabase.db3"),
        db("Magnus_chesscom.db3"),
        db("MillionBase.db3"),
        db("Anna_lichess.db3"),
        // An account that's no longer linked: an ordinary database
        db("Removed_lichess.db3"),
    ];
    const split = splitAccountDatabases(page, [lichess("Anna"), chessCom("Magnus")]);
    expect(names(split.accounts)).toEqual(["Magnus_chesscom.db3", "Anna_lichess.db3"]);
    expect(names(split.others)).toEqual([
        "Caissabase.db3",
        "MillionBase.db3",
        "Removed_lichess.db3",
    ]);
    expect(split.headings).toBe(true);
});

test("an account's database is found whatever the capitalisation of its file", () => {
    // Downloaded when the account was spelled differently
    const split = splitAccountDatabases([db("anna_LICHESS.db3")], [lichess("Anna")]);
    expect(names(split.accounts)).toEqual(["anna_LICHESS.db3"]);
});

test("without both kinds of database, the page has no headings", () => {
    expect(splitAccountDatabases([db("Caissabase.db3")], [lichess("Anna")]).headings).toBe(false);
    expect(splitAccountDatabases([db("Anna_lichess.db3")], [lichess("Anna")]).headings).toBe(false);
    expect(splitAccountDatabases([db("Anna_lichess.db3")], []).headings).toBe(false);
});
