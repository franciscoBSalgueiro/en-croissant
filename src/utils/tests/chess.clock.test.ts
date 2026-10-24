import { parseComment, parsePgn } from "chessops/pgn";
import { afterEach, expect, test, vi } from "vitest";
import { commands } from "@/bindings";
import { getPGN, parsePGN } from "../chess";

afterEach(() => vi.restoreAllMocks());

test.each([
    ["0:00:00", 0],
    ["0:00:00.5", 0.5],
    ["0:10:00", 600],
] as const)("PGN clock %s survives parsing and export", async (annotation, seconds) => {
    // Only native tokenization is mocked. Parsing, tree construction and export are real.
    vi.spyOn(commands, "lexPgn").mockResolvedValue({
        status: "ok",
        data: [
            { type: "San", value: "e4" },
            { type: "Comment", value: `[%clk ${annotation}]` },
            { type: "Outcome", value: "*" },
        ],
    });
    const tree = await parsePGN(`1. e4 {[%clk ${annotation}]} *`);
    expect(tree.root.children[0].clock).toBe(seconds);
    const pgn = getPGN(tree.root, {
        headers: tree.headers,
        glyphs: true,
        comments: true,
        variations: true,
        extraMarkups: true,
    });
    const exported = parsePgn(pgn)[0].moves.children[0].data;
    expect(parseComment(exported.comments!.join(" ")).clock).toBe(seconds);
});
