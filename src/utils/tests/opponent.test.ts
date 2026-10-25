import { expect, test } from "vitest";
import { buildOpponentBook, opponentElo } from "../opponent";

const ROOT_KEY = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
const AFTER_E4_KEY = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -";
const AFTER_E4_E5_KEY = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -";
const AFTER_1D4_NF6_2C4_KEY = "rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -";

test("should record the next move of every position below maxPly", () => {
    const games = [{ moves: "e2e4 e7e5 g1f3 b1c3" }, { moves: "e2e4 e7e5 g1f3 b1c3" }];
    const { book, playerCount } = buildOpponentBook(games, 3);

    expect(playerCount).toBe(2);
    expect(book.maxPly).toBe(3);
    expect(book.positions[ROOT_KEY]).toEqual([{ uci: "e2e4", san: "e4", weight: 2 }]);
    expect(book.positions[AFTER_E4_KEY]).toEqual([{ uci: "e7e5", san: "e5", weight: 2 }]);
    expect(book.positions[AFTER_E4_E5_KEY]).toEqual([{ uci: "g1f3", san: "Nf3", weight: 2 }]);
    // The position before the 4th move is at ply 3, so "b1c3" is not recorded.
    expect(Object.keys(book.positions)).toHaveLength(3);
});

test("should merge transpositions into a single key", () => {
    const games = [{ moves: "d2d4 g8f6 c2c4 e7e6" }, { moves: "c2c4 g8f6 d2d4 e7e6" }];
    const { book } = buildOpponentBook(games, 4);

    // Both move orders reach the same position after three plies.
    expect(book.positions[AFTER_1D4_NF6_2C4_KEY]).toEqual([{ uci: "e7e6", san: "e6", weight: 2 }]);
    // The root position keeps one entry per distinct move.
    expect(book.positions[ROOT_KEY]).toEqual([
        { uci: "d2d4", san: "d4", weight: 1 },
        { uci: "c2c4", san: "c4", weight: 1 },
    ]);
});

test("should key positions by the first four FEN fields", () => {
    const { book } = buildOpponentBook([{ moves: "e2e4 e7e5 g1f3" }], 3);

    expect(Object.keys(book.positions)).toHaveLength(3);
    for (const key of Object.keys(book.positions)) {
        const fields = key.split(" ");
        expect(fields).toHaveLength(4);
    }
    expect(Object.keys(book.positions)).toContain(ROOT_KEY);
});

test("should support games with a custom starting FEN and average elos", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    const { book, avgElo } = buildOpponentBook(
        [
            { fen, moves: "g1f3", elo: 1200 },
            { fen, moves: "g1f3", elo: null },
        ],
        3,
    );

    expect(book.positions[AFTER_E4_E5_KEY]).toEqual([{ uci: "g1f3", san: "Nf3", weight: 2 }]);
    expect(avgElo).toBe(1200);
});

test("should average non-null elos only", () => {
    expect(opponentElo([1200, null, undefined, 1800])).toBe(1500);
    expect(opponentElo([1000, 1001])).toBe(1001);
    expect(opponentElo([2800])).toBe(2800);
    expect(opponentElo([null, undefined])).toBeUndefined();
    expect(opponentElo([])).toBeUndefined();
});
