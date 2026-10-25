import type { Color } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { describe, expect, test } from "vitest";
import { makeSan, parseSan } from "chessops/san";
import { positionFromFen } from "../chessops";
import {
    CP_LOSS_THRESHOLD,
    MAX_PLIES,
    computeCpLoss,
    defaultTrainingSide,
    extractMainline,
    initialQuizState,
    moveNumber,
    quizAccuracy,
    quizReducer,
    scoreGuess,
    uciToSquares,
    type QuizState,
} from "../replayTraining";
import { createNode, defaultTree, type TreeNode } from "../treeReducer";

/**
 * Builds a mainline game tree in the same shape `parsePGN` produces:
 * the root holds the starting FEN and each child stores the FEN after its
 * move. `parsePGN` itself invokes the backend lexer, so tests build the
 * tree directly with chessops instead.
 */
function buildMainlineTree(startFen: string, sans: string[]): TreeNode {
    const root = defaultTree(startFen).root;
    const [pos] = positionFromFen(startFen);
    if (!pos) {
        throw new Error(`invalid FEN ${startFen}`);
    }
    let parent = root;
    let halfMoves = root.halfMoves;
    for (const san of sans) {
        const move = parseSan(pos, san);
        if (!move) {
            throw new Error(`illegal SAN ${san}`);
        }
        const normalizedSan = makeSan(pos, move);
        pos.play(move);
        halfMoves++;
        const node = createNode({
            fen: makeFen(pos.toSetup()),
            move,
            san: normalizedSan,
            halfMoves,
        });
        parent.children.push(node);
        parent = node;
    }
    return root;
}

function startQuiz(sans: string[], side: Color, startFen: string = INITIAL_FEN): QuizState {
    const root = buildMainlineTree(startFen, sans);
    return quizReducer(initialQuizState, {
        type: "start",
        moves: extractMainline(root),
        rootFen: root.fen,
        side,
    });
}

describe("mainline extraction", () => {
    test("extracts SAN, UCI, resulting FEN and mover color", () => {
        const root = buildMainlineTree(INITIAL_FEN, ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
        const moves = extractMainline(root);
        expect(moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
        expect(moves.map((m) => m.uci)).toEqual(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"]);
        expect(moves.map((m) => m.color)).toEqual([
            "white",
            "black",
            "white",
            "black",
            "white",
            "black",
        ]);
        // FEN after 1.e4 has black to move
        expect(moves[0].fen.split(" ")[1]).toBe("b");
        expect(moves[0].fen).not.toBe(INITIAL_FEN);
    });

    test("follows only the first child, ignoring variations", () => {
        const root = buildMainlineTree(INITIAL_FEN, ["e4", "e5"]);
        // attach 1.d4 d5 as a sibling variation of 1.e4
        const variation = buildMainlineTree(INITIAL_FEN, ["d4", "d5"]);
        root.children.push(variation.children[0]);
        // and 1...c5 as a sibling of 1...e5 inside the mainline
        const altSecond = buildMainlineTree(findNode(root, 1).fen, ["c5"]);
        findNode(root, 1).children.push(altSecond.children[0]);

        const moves = extractMainline(root);
        expect(moves.map((m) => m.san)).toEqual(["e4", "e5"]);
    });

    test("caps the mainline at the ply limit", () => {
        const cycle = ["Nf3", "Nf6", "Ng1", "Ng8"];
        const sans: string[] = [];
        for (let i = 0; i < 100; i++) {
            sans.push(...cycle);
        }
        const root = buildMainlineTree(INITIAL_FEN, sans);
        expect(extractMainline(root, 10)).toHaveLength(10);
        expect(extractMainline(root)).toHaveLength(MAX_PLIES);
    });

    test("handles games starting from a FEN with black to move", () => {
        const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
        const root = buildMainlineTree(fen, ["e5", "Nf3"]);
        const moves = extractMainline(root);
        expect(moves[0].san).toBe("e5");
        expect(moves[0].color).toBe("black");
        expect(moves[1].color).toBe("white");
    });
});

describe("move comparison and scoring", () => {
    test("exact SAN match is correct", () => {
        expect(scoreGuess("Nf3", "Nf3")).toEqual({ outcome: "correct", points: 10 });
        expect(scoreGuess("Qxf7#", "Qxf7#")).toEqual({ outcome: "correct", points: 10 });
    });

    test("different move without engine scoring is incorrect", () => {
        expect(scoreGuess("Nf3", "Nc3")).toEqual({ outcome: "incorrect", points: 0 });
    });

    test("cp loss within threshold earns alternative credit", () => {
        expect(scoreGuess("Nf3", "Nc3", 0)).toEqual({ outcome: "alternative", points: 5 });
        expect(scoreGuess("Nf3", "Nc3", CP_LOSS_THRESHOLD)).toEqual({
            outcome: "alternative",
            points: 5,
        });
        expect(scoreGuess("Nf3", "Nc3", CP_LOSS_THRESHOLD + 1)).toEqual({
            outcome: "incorrect",
            points: 0,
        });
    });

    test("cp loss is the absolute difference of white-POV evaluations", () => {
        expect(computeCpLoss(50, 80)).toBe(30);
        expect(computeCpLoss(80, 50)).toBe(30);
        expect(computeCpLoss(-120, 60)).toBe(180);
    });
});

describe("quiz reducer", () => {
    test("starts on the trained side's first move", () => {
        const white = startQuiz(["e4", "e5", "Nf3"], "white");
        expect(white.phase).toBe("guessing");
        expect(white.index).toBe(0);
        expect(white.boardFen).toBe(INITIAL_FEN);
        expect(white.lastMoveUci).toBeNull();

        const black = startQuiz(["e4", "e5", "Nf3"], "black");
        expect(black.index).toBe(1);
        expect(black.boardFen).toBe(black.moves[0].fen);
        expect(black.lastMoveUci).toBe("e2e4");
    });

    test("finishes immediately when the trained side has no moves", () => {
        const state = startQuiz(["e4"], "black");
        expect(state.phase).toBe("finished");
    });

    test("correct guess earns points and advance plays the reply", () => {
        let state = startQuiz(["e4", "e5", "Nf3", "Nc6", "Bb5"], "white");
        state = quizReducer(state, {
            type: "guess",
            playedSan: "e4",
            playedUci: "e2e4",
            playedFen: state.moves[0].fen,
        });
        expect(state.phase).toBe("reveal");
        expect(state.score).toBe(10);
        expect(state.asked).toBe(1);
        expect(state.correct).toBe(1);
        expect(state.feedback?.outcome).toBe("correct");
        expect(state.boardFen).toBe(state.moves[0].fen);

        state = quizReducer(state, { type: "advance" });
        expect(state.phase).toBe("guessing");
        expect(state.index).toBe(2);
        // the opponent's reply e5 is highlighted
        expect(state.lastMoveUci).toBe("e7e5");
        expect(state.boardFen).toBe(state.moves[1].fen);
        expect(state.feedback).toBeNull();
    });

    test("good alternative earns partial credit", () => {
        let state = startQuiz(["e4", "e5"], "white");
        state = quizReducer(state, {
            type: "guess",
            playedSan: "d4",
            playedUci: "d2d4",
            playedFen: "fen-after-d4",
            cpLoss: 12,
        });
        expect(state.score).toBe(5);
        expect(state.alternatives).toBe(1);
        expect(state.asked).toBe(1);
        expect(state.feedback?.outcome).toBe("alternative");
        expect(state.feedback?.cpLoss).toBe(12);
    });

    test("wrong guess scores nothing", () => {
        let state = startQuiz(["e4", "e5"], "white");
        state = quizReducer(state, {
            type: "guess",
            playedSan: "d4",
            playedUci: "d2d4",
            playedFen: "fen-after-d4",
            cpLoss: 200,
        });
        expect(state.score).toBe(0);
        expect(state.feedback?.outcome).toBe("incorrect");
        expect(state.feedback?.expectedSan).toBe("e4");
    });

    test("skip reveals the recorded move without counting as asked", () => {
        let state = startQuiz(["e4", "e5", "Nf3"], "white");
        state = quizReducer(state, { type: "skip" });
        expect(state.phase).toBe("reveal");
        expect(state.skipped).toBe(1);
        expect(state.asked).toBe(0);
        expect(state.score).toBe(0);
        expect(state.boardFen).toBe(state.moves[0].fen);
        expect(state.lastMoveUci).toBe("e2e4");
        expect(state.feedback?.outcome).toBe("skipped");
        expect(state.feedback?.playedSan).toBeNull();

        state = quizReducer(state, { type: "advance" });
        expect(state.phase).toBe("guessing");
        expect(state.index).toBe(2);
    });

    test("finishes when the mainline is exhausted", () => {
        let state = startQuiz(["e4", "e5"], "white");
        state = quizReducer(state, {
            type: "guess",
            playedSan: "e4",
            playedUci: "e2e4",
            playedFen: state.moves[0].fen,
        });
        state = quizReducer(state, { type: "advance" });
        expect(state.phase).toBe("finished");
        expect(quizAccuracy(state)).toBe(100);
    });

    test("finishes when the game ends right after the guessed move", () => {
        let state = startQuiz(["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"], "white");
        const guesses = [
            { san: "e4", uci: "e2e4", ply: 0 },
            { san: "Qh5", uci: "d1h5", ply: 2 },
            { san: "Bc4", uci: "f1c4", ply: 4 },
            { san: "Qxf7#", uci: "h5f7", ply: 6 },
        ] as const;
        for (const guess of guesses) {
            state = quizReducer(state, {
                type: "guess",
                playedSan: guess.san,
                playedUci: guess.uci,
                playedFen: state.moves[guess.ply].fen,
            });
            state = quizReducer(state, { type: "advance" });
        }
        expect(state.phase).toBe("finished");
        expect(state.score).toBe(40);
        expect(state.asked).toBe(4);
    });

    test("actions are ignored outside their phase", () => {
        const state = startQuiz(["e4", "e5"], "white");
        expect(quizReducer(state, { type: "advance" })).toBe(state);
        expect(quizReducer(state, { type: "skip" })).not.toBe(state);

        let revealed = quizReducer(state, { type: "skip" });
        revealed = quizReducer(revealed, {
            type: "guess",
            playedSan: "e4",
            playedUci: "e2e4",
            playedFen: "x",
        });
        // guess during reveal does not double count
        expect(revealed.asked).toBe(0);
        expect(revealed.skipped).toBe(1);
    });

    test("accuracy counts alternatives half", () => {
        let state = startQuiz(["e4", "e5", "Nf3", "Nc6"], "white");
        state = quizReducer(state, {
            type: "guess",
            playedSan: "e4",
            playedUci: "e2e4",
            playedFen: "x",
        });
        state = quizReducer(state, { type: "advance" });
        state = quizReducer(state, {
            type: "guess",
            playedSan: "Nc3",
            playedUci: "g1c3",
            playedFen: "x",
            cpLoss: 20,
        });
        expect(quizAccuracy(state)).toBe(75);
        expect(quizAccuracy(initialQuizState)).toBe(0);
    });

    test("reset returns to the idle state", () => {
        let state = startQuiz(["e4", "e5"], "white");
        state = quizReducer(state, { type: "reset" });
        expect(state).toEqual(initialQuizState);
    });
});

describe("helpers", () => {
    test("default side is the lower-rated player", () => {
        expect(defaultTrainingSide(2000, 1500)).toBe("black");
        expect(defaultTrainingSide(1500, 2000)).toBe("white");
        expect(defaultTrainingSide(1500, 1500)).toBe("white");
        expect(defaultTrainingSide(null, 1200)).toBe("white");
        expect(defaultTrainingSide(0, 1200)).toBe("white");
        expect(defaultTrainingSide(1200, undefined)).toBe("black");
    });

    test("move number is 1-based per full move", () => {
        expect(moveNumber(0)).toBe(1);
        expect(moveNumber(1)).toBe(1);
        expect(moveNumber(2)).toBe(2);
        expect(moveNumber(6)).toBe(4);
    });

    test("uci splits into from/to squares", () => {
        expect(uciToSquares("e2e4")).toEqual(["e2", "e4"]);
        expect(uciToSquares("e7e8q")).toEqual(["e7", "e8"]);
        expect(uciToSquares("e1g1")).toEqual(["e1", "g1"]);
        expect(uciToSquares("xx")).toBeUndefined();
        expect(uciToSquares("e9e4")).toBeUndefined();
    });
});

/** Mainline node after the first `plies` moves of `root`. */
function findNode(root: TreeNode, plies: number): TreeNode {
    let node = root;
    for (let i = 0; i < plies; i++) {
        node = node.children[0];
    }
    return node;
}
