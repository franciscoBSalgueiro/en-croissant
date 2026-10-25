import { expect, test } from "vitest";
import { ANNOTATION_INFO, type Annotation, NAG_INFO } from "../annotation";
import { parseSquare } from "chessops";
import { getMoveDestination, hasMorePriority, headersToPGN, parsePGNTokens } from "../chess";

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

test("adjacent comments are merged instead of overwritten", () => {
    const tree = parsePGNTokens([
        { type: "San", value: "e4" },
        { type: "Comment", value: "first comment" },
        { type: "Comment", value: "second comment" },
        { type: "San", value: "e5" },
        { type: "Comment", value: "only comment here" },
    ]);

    expect(tree.root.children[0].comment).toBe("first comment second comment");
    expect(tree.root.children[0].children[0].comment).toBe("only comment here");
});

test("chess.com timestamps are stripped before comments are merged", () => {
    const tree = parsePGNTokens([
        { type: "San", value: "d4" },
        { type: "Comment", value: "opening [%timestamp 12] idea" },
        { type: "Comment", value: "[%timestamp 34]" },
    ]);

    expect(tree.root.children[0].comment).toBe("opening idea");
});
