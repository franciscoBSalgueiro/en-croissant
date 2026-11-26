import { expect, test, vi } from "vitest";
import { ANNOTATION_INFO, type Annotation, NAG_INFO } from "../annotation";
import { parseSquare } from "chessops";
import type { GameHeaders } from "../treeReducer";
import { getMoveDestination, hasMorePriority, headersToPGN, parsePGN } from "../chess";

const { lexPgn } = vi.hoisted(() => ({
    lexPgn: vi.fn<(pgn: string) => Promise<{ status: "ok"; data: unknown[] }>>(),
}));

vi.mock("@/bindings", () => ({ commands: { lexPgn } }));

type HeaderToken = {
    type: "Header";
    value: { tag: string; value: string };
};

function headerTokens(headers: Record<string, string>): HeaderToken[] {
    return Object.entries(headers).map(([tag, value]) => ({
        type: "Header",
        value: { tag, value },
    }));
}

async function parsePGNHeaders(headers: Record<string, string>) {
    lexPgn.mockResolvedValue({ status: "ok", data: headerTokens(headers) });
    return (await parsePGN("")).headers;
}

test("NAGs are consistent", () => {
    for (const k of Object.keys(ANNOTATION_INFO)) {
        if (k === "") continue;
        const nag = ANNOTATION_INFO[k as Annotation].nag!;
        expect(NAG_INFO.get(`$${nag}`)).toBe(k);
    }
});

test("priority comparison", () => {
    expect(hasMorePriority([0, 0], [0])).toBe(false);
    expect(hasMorePriority([0], [0, 0])).toBe(true);
    expect(hasMorePriority([0], [1])).toBe(true);
    expect(hasMorePriority([1], [0])).toBe(false);
    expect(hasMorePriority([0, 0], [0, 1])).toBe(true);
    expect(hasMorePriority([0, 1], [0, 0])).toBe(false);
    expect(hasMorePriority([0, 1], [0, 2])).toBe(true);
    expect(hasMorePriority([0, 2], [0, 1])).toBe(false);
});

test("PGN headers preserve UTC time", () => {
    const pgn = headersToPGN({
        id: 1,
        fen: "",
        event: "Live Chess",
        site: "https://www.chess.com/game/live/1",
        date: "2026.09.19",
        time: "12:34:56",
        round: "-",
        white: "White",
        black: "Black",
        result: "1-0",
    });

    expect(pgn).toContain('[UTCTime "12:34:56"]');
});

test("castling destination ignores a check or mate suffix", () => {
    const white = (san: string) =>
        getMoveDestination({ san, halfMoves: 1, move: { from: 4, to: 0 } });
    const black = (san: string) =>
        getMoveDestination({ san, halfMoves: 2, move: { from: 60, to: 63 } });
    expect(white("O-O-O")).toBe(parseSquare("c1"));
    expect(white("O-O-O+")).toBe(parseSquare("c1"));
    expect(white("O-O-O#")).toBe(parseSquare("c1"));
    expect(black("O-O")).toBe(parseSquare("g8"));
    expect(black("O-O+")).toBe(parseSquare("g8"));
    expect(getMoveDestination({ san: "Nf3+", halfMoves: 1, move: { from: 6, to: 21 } })).toBe(21);
});

test("unusable PGN rating tags become unrated", async () => {
    for (const value of ["?", "??", "-", "0", "", "N/A", "unrated", "invalid", "-5", "999999"]) {
        const headers = await parsePGNHeaders({ WhiteElo: value, BlackElo: value });
        expect(headers.white_elo).toBe(0);
        expect(headers.black_elo).toBe(0);
    }
});

test("numeric PGN rating tags are trimmed and parsed", async () => {
    for (const [value, expected] of [
        ["2100", 2100],
        ["02300", 2300],
        ["+2100", 2100],
        [" 2100 ", 2100],
    ] as const) {
        const headers = await parsePGNHeaders({ WhiteElo: value, BlackElo: value });
        expect(headers.white_elo).toBe(expected);
        expect(headers.black_elo).toBe(expected);
    }
});

test("absent PGN rating tags stay unknown", async () => {
    const headers = await parsePGNHeaders({ White: "White", Black: "Black" });
    expect(headers.white_elo).toBeUndefined();
    expect(headers.black_elo).toBeUndefined();
});

test("PGN export writes ratings as integers or as the unrated dash", () => {
    const headers = (extra: Partial<GameHeaders> = {}): GameHeaders => ({
        id: 1,
        fen: "",
        event: "Live Chess",
        site: "https://www.chess.com/game/live/1",
        date: "2026.09.19",
        round: "-",
        white: "White",
        black: "Black",
        result: "1-0",
        ...extra,
    });

    const rated = headersToPGN(headers({ white_elo: 2100, black_elo: 0 }));
    expect(rated).toContain('[WhiteElo "2100"]');
    expect(rated).toContain('[BlackElo "-"]');

    const unusable = headersToPGN(headers({ white_elo: Number.NaN, black_elo: -5 }));
    expect(unusable).toContain('[WhiteElo "-"]');
    expect(unusable).toContain('[BlackElo "-"]');

    const missing = headersToPGN(headers());
    expect(missing).not.toContain("[WhiteElo ");
    expect(missing).not.toContain("[BlackElo ");
});
