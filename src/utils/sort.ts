import type { DatabaseInfo } from "@/bindings";
import type { Session } from "./session";

// File types in alphabetical order of their names as shown (so in the user's language), with
// "other" last, as is conventional
export function sortFileTypes<T>(
    types: readonly T[],
    type: (item: T) => string,
    label: (item: T) => string,
): T[] {
    return [...types].sort(
        (a, b) =>
            Number(type(a) === "other") - Number(type(b) === "other") ||
            label(a).localeCompare(label(b)),
    );
}

// Databases by name, then the ones that couldn't be read (shown by their error) by file name
export function sortDatabases(databases: DatabaseInfo[]): DatabaseInfo[] {
    return [...databases].sort((a, b) => {
        if (a.type !== b.type) return a.type === "success" ? -1 : 1;
        if (a.type === "success" && b.type === "success") return a.title.localeCompare(b.title);
        return a.filename.localeCompare(b.filename);
    });
}

// Accounts by username; with the same username on both sites, Chess.com first
export function compareAccounts(a: Session, b: Session) {
    const username = (s: Session) => s.lichess?.username ?? s.chessCom?.username ?? "";
    const site = (s: Session) => (s.chessCom ? 0 : 1);
    return username(a).localeCompare(username(b)) || site(a) - site(b);
}
