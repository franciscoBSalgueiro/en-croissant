import { expect, test } from "vitest";
import { parsePGN } from "@/utils/chess";
import {
    savedGamePgn,
    savedGamePlayers,
    savedGameResult,
    type SavedGame,
} from "@/utils/savedGames";
import { Chess } from "chessops/chess";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { parseUci } from "chessops";
function record(): SavedGame {
    const position = Chess.default();
    position.play(parseUci("e2e4")!);
    const fen = makeFen(position.toSetup());
    return {
        version: 1,
        id: "saved",
        startedAt: Date.UTC(2026, 9, 15),
        updatedAt: Date.UTC(2026, 9, 15),
        config: {
            white: { type: "human", name: "Alice" },
            black: {
                type: "engine",
                name: "Stockfish",
                path: "/sf",
                options: [{ name: "Skill Level", value: "5" }],
                go: { t: "Depth", c: 12 },
            },
            whiteTimeControl: { initialTime: BigInt(180000), increment: BigInt(2000) },
            blackTimeControl: null,
            initialFen: null,
            initialMoves: [],
            openingBook: null,
            sourcePgn: null,
        },
        state: {
            gameId: "old-game",
            status: "playing",
            initialFen: INITIAL_FEN,
            currentFen: fen,
            ply: 1,
            turn: "black",
            whiteTime: BigInt(178000),
            blackTime: null,
            whitePlayer: "Alice",
            blackPlayer: "Stockfish",
            moves: [
                {
                    uci: "e2e4",
                    san: "e4",
                    fenAfter: fen,
                    clock: BigInt(178000),
                    whiteTime: BigInt(178000),
                    blackTime: null,
                },
            ],
        },
    };
}
test("history exports moves, clocks, players, time control, dates and results to PGN", async () => {
    const game = record();
    game.state.status = { finished: { result: { type: "blackWins", reason: "resignation" } } };
    const pgn = savedGamePgn(game);
    const tree = await parsePGN(pgn);
    expect(tree.headers.white).toBe("Alice");
    expect(tree.headers.black).toBe("Stockfish");
    expect(tree.headers.date).toBe("2026.10.15");
    expect(tree.headers.white_time_control).toBe("180+2");
    expect(tree.headers.result).toBe("0-1");
    expect(tree.root.children[0].fen).toBe(game.state.currentFen);
    expect(tree.root.children[0].clock).toBe(178);
    expect(pgn).toContain('[Termination "resignation"]');
});
test("recovered engine settings retain level, search limits, paths and clocks", () => {
    const game = record();
    const players = savedGamePlayers(game.config);
    expect(players.white).toMatchObject({
        type: "human",
        name: "Alice",
        timeControl: { seconds: 180000, increment: 2000 },
    });
    expect(players.black).toMatchObject({
        type: "engine",
        go: { t: "Depth", c: 12 },
        engine: { path: "/sf" },
        engineSettings: [{ name: "Skill Level", value: "5" }],
    });
    expect(savedGameResult(game.state.status)).toBe("*");
});
test("a zero clock is preserved in a recovered game", async () => {
    const game = record();
    game.state.moves[0].whiteTime = BigInt(0);
    const tree = await parsePGN(savedGamePgn(game));
    expect(tree.root.children[0].clock).toBe(0);
});

test("source annotations and custom headers survive game history export", async () => {
    const game = record();
    game.config.sourcePgn =
        '[Event "Original"]\n[Custom "keep"]\n[WhiteElo "1400"]\n\n{Opening note} 1. e4 $1 {Idea [%clk 0:01:00]} *';
    const tree = await parsePGN(savedGamePgn(game));
    expect(tree.root.comment).toBe("Opening note");
    expect(tree.root.children[0].annotations).toContain("!");
    expect(tree.root.children[0].comment).toBe("Idea");
    expect(tree.root.children[0].clock).toBe(178);
    expect(tree.headers.white_elo).toBe(1400);
    expect(tree.headers.other?.Custom).toBe("keep");
});

test("unsupported source annotations cannot block recovering the actual game", async () => {
    const game = record();
    game.config.sourcePgn = '[Variant "Atomic"]\n\n1. e4 *';
    const tree = await parsePGN(savedGamePgn(game));
    expect(tree.root.children[0].san).toBe("e4");
    expect(game.config.sourcePgn).toContain("Atomic");
});

test("the shared PGN parser still accepts a blank new analysis board", async () => {
    const tree = await parsePGN("");
    expect(tree.root.children).toHaveLength(0);
    expect(tree.root.fen).toBe(INITIAL_FEN);
});
