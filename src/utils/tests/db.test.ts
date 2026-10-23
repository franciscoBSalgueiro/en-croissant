import { expect, test } from "vitest";
import type { DatabaseInfo } from "@/bindings";
import { isDefaultDatabaseInstalled } from "../db";

const database = (title: string, filename: string) =>
    ({ type: "success", title, filename, file: `/dbs/${filename}` }) as DatabaseInfo;

test("a downloaded database counts as installed even when its own title differs from the list's", () => {
    // Downloaded from the list as "Lumbra's Gigabase", saved as that file, titled differently inside
    const lumbra = database("LumbrasGigaBase", "Lumbra's Gigabase.db3");
    expect(isDefaultDatabaseInstalled([lumbra], "Lumbra's Gigabase")).toBe(true);
    // Added some other way, but with the list's title
    const caissabase = database("Caissabase 2024", "my copy.db3");
    expect(isDefaultDatabaseInstalled([caissabase], "Caissabase 2024")).toBe(true);
    // Neither: still offered for download
    expect(isDefaultDatabaseInstalled([lumbra, caissabase], "MillionBase")).toBe(false);
});

test("a downloaded file that can't be read is offered for download again", () => {
    const broken = {
        type: "error",
        filename: "/dbs/Lumbra's Gigabase.db3",
        file: "/dbs/Lumbra's Gigabase.db3",
        error: "can't be read",
        indexed: false,
    } as DatabaseInfo;
    expect(isDefaultDatabaseInstalled([broken], "Lumbra's Gigabase")).toBe(false);
});
