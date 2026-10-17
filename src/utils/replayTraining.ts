import type { Color } from "chessops";
import { makeSquare, parseSquare } from "chessops";
import type { SquareName } from "chessops";
import { uciNormalize } from "./chess";
import { positionFromFen } from "./chessops";
import type { TreeNode } from "./treeReducer";

/**
 * Pure helpers and state machine for replay training (guess-the-move).
 *
 * The quiz is fully local React state driven by `quizReducer`; the only
 * backend interaction (optional engine scoring via `evaluatePosition`)
 * happens in the modal component, which feeds the computed centipawn loss
 * back into the reducer as part of the `guess` action.
 */

/** A cap of 80 full moves (= 160 plies) per training session. */
export const MAX_PLIES = 160;

/** Centipawn loss at or below which a non-exact guess earns partial credit. */
export const CP_LOSS_THRESHOLD = 30;

export const POINTS_CORRECT = 10;
export const POINTS_ALTERNATIVE = 5;

/** One mainline ply, as extracted from a parsed game tree. */
export type ReplayMove = {
    /** SAN of the move (normalized by chessops `makeSan`). */
    san: string;
    /** Normalized UCI (e2e4, e7e8q, castling as king-to-rook when relevant). */
    uci: string;
    /** FEN of the position AFTER this move. */
    fen: string;
    /** Color of the player who played this move. */
    color: Color;
};

/**
 * Walks the first-child (mainline) chain of a parsed game tree and collects
 * the moves with their normalized UCI, resulting FEN and mover color.
 * This is the shape produced by `parsePGN` (see `utils/chess.ts`): the tree
 * root holds the starting position and every node stores the FEN after its
 * move plus the parsed chessops `Move`.
 *
 * The mainline is capped at `maxPlies` (defaults to MAX_PLIES).
 */
export function extractMainline(root: TreeNode, maxPlies: number = MAX_PLIES): ReplayMove[] {
    const moves: ReplayMove[] = [];
    const [pos] = positionFromFen(root.fen);
    if (!pos) {
        return [];
    }
    let node: TreeNode | undefined = root;
    while (node && moves.length < maxPlies) {
        const child: TreeNode | undefined = node.children[0];
        if (!child || !child.move) {
            break;
        }
        moves.push({
            san: child.san ?? uciNormalize(pos, child.move),
            uci: uciNormalize(pos, child.move),
            fen: child.fen,
            color: pos.turn,
        });
        pos.play(child.move);
        node = child;
    }
    return moves;
}

/**
 * Default training side: the lower-rated player. Missing/unrated (null or 0)
 * counts as 0, so an unrated player is chosen over a rated one; ties go to
 * white.
 */
export function defaultTrainingSide(whiteElo?: number | null, blackElo?: number | null): Color {
    const white = whiteElo ?? 0;
    const black = blackElo ?? 0;
    return white <= black ? "white" : "black";
}

export type GuessOutcome = "correct" | "alternative" | "incorrect" | "skipped";

export type GuessFeedback = {
    outcome: GuessOutcome;
    /** SAN of the recorded move that was expected. */
    expectedSan: string;
    /** SAN the user actually played (null when the move was skipped). */
    playedSan: string | null;
    /** Engine-measured centipawn loss of the guess (engine scoring only). */
    cpLoss?: number;
};

export type ReplayPhase = "idle" | "guessing" | "reveal" | "finished";

export type QuizState = {
    phase: ReplayPhase;
    /** The side being trained (whose moves must be guessed). */
    side: Color;
    moves: ReplayMove[];
    rootFen: string;
    /** Ply index (into `moves`) of the next move to guess. */
    index: number;
    /** FEN currently displayed on the board. */
    boardFen: string;
    /** UCI of the last played/revealed move (for highlight). */
    lastMoveUci: string | null;
    score: number;
    /** Number of real guesses (correct + alternative + incorrect). */
    asked: number;
    correct: number;
    alternatives: number;
    skipped: number;
    feedback: GuessFeedback | null;
};

export type QuizAction =
    | { type: "start"; moves: ReplayMove[]; rootFen: string; side: Color }
    | {
          type: "guess";
          playedSan: string;
          playedUci: string;
          playedFen: string;
          cpLoss?: number;
      }
    | { type: "skip" }
    | { type: "advance" }
    | { type: "reset" };

export const initialQuizState: QuizState = {
    phase: "idle",
    side: "white",
    moves: [],
    rootFen: "",
    index: 0,
    boardFen: "",
    lastMoveUci: null,
    score: 0,
    asked: 0,
    correct: 0,
    alternatives: 0,
    skipped: 0,
    feedback: null,
};

/**
 * Scores a guess against the recorded move.
 *
 * - Exact SAN match: correct (POINTS_CORRECT).
 * - Different move, but engine scoring measured a centipawn loss of at most
 *   CP_LOSS_THRESHOLD: "good alternative" (POINTS_ALTERNATIVE).
 * - Anything else: incorrect (0 points).
 */
export function scoreGuess(
    playedSan: string,
    expectedSan: string,
    cpLoss?: number,
): { outcome: "correct" | "alternative" | "incorrect"; points: number } {
    if (playedSan === expectedSan) {
        return { outcome: "correct", points: POINTS_CORRECT };
    }
    if (cpLoss !== undefined && cpLoss <= CP_LOSS_THRESHOLD) {
        return { outcome: "alternative", points: POINTS_ALTERNATIVE };
    }
    return { outcome: "incorrect", points: 0 };
}

/** Centipawn loss between two white-POV evaluations. */
export function computeCpLoss(cpGuess: number, cpPlayed: number): number {
    return Math.abs(cpGuess - cpPlayed);
}

/**
 * Quiz accuracy in percent: exact guesses count fully, good alternatives
 * count half. Returns 0 when nothing was asked yet.
 */
export function quizAccuracy(state: QuizState): number {
    if (state.asked === 0) {
        return 0;
    }
    return ((state.correct + state.alternatives * 0.5) / state.asked) * 100;
}

/** Human move number (1-based) for a ply index. */
export function moveNumber(plyIndex: number): number {
    return Math.floor(plyIndex / 2) + 1;
}

/** Splits a UCI string into its from/to squares for chessground highlight. */
export function uciToSquares(uci: string): [SquareName, SquareName] | undefined {
    if (uci.length < 4) {
        return undefined;
    }
    const from = parseSquare(uci.slice(0, 2));
    const to = parseSquare(uci.slice(2, 4));
    if (!from || !to) {
        return undefined;
    }
    return [makeSquare(from), makeSquare(to)];
}

function firstIndexForSide(moves: ReplayMove[], side: Color): number {
    return moves.findIndex((move) => move.color === side);
}

/**
 * Advances past the move that was just revealed (at `index`): the recorded
 * move plus, when present, the opponent's instant reply. Returns the new
 * ply index, or `null` when the game/cap has been exhausted.
 */
function advanceIndex(moves: ReplayMove[], index: number, side: Color): number | null {
    let next = index + 1; // the recorded move
    if (next < moves.length && moves[next].color !== side) {
        next++; // the opponent's reply
    }
    return next < moves.length ? next : null;
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
    switch (action.type) {
        case "start": {
            const index = firstIndexForSide(action.moves, action.side);
            if (index < 0) {
                return {
                    ...initialQuizState,
                    phase: "finished",
                    side: action.side,
                    moves: action.moves,
                    rootFen: action.rootFen,
                };
            }
            return {
                ...initialQuizState,
                phase: "guessing",
                side: action.side,
                moves: action.moves,
                rootFen: action.rootFen,
                index,
                boardFen: index === 0 ? action.rootFen : action.moves[index - 1].fen,
                lastMoveUci: index === 0 ? null : action.moves[index - 1].uci,
            };
        }
        case "guess": {
            if (state.phase !== "guessing") {
                return state;
            }
            const expected = state.moves[state.index];
            if (!expected) {
                return state;
            }
            const { outcome, points } = scoreGuess(action.playedSan, expected.san, action.cpLoss);
            return {
                ...state,
                phase: "reveal",
                score: state.score + points,
                asked: state.asked + 1,
                correct: state.correct + (outcome === "correct" ? 1 : 0),
                alternatives: state.alternatives + (outcome === "alternative" ? 1 : 0),
                boardFen: action.playedFen,
                lastMoveUci: action.playedUci,
                feedback: {
                    outcome,
                    expectedSan: expected.san,
                    playedSan: action.playedSan,
                    cpLoss: action.cpLoss,
                },
            };
        }
        case "skip": {
            if (state.phase !== "guessing") {
                return state;
            }
            const expected = state.moves[state.index];
            if (!expected) {
                return state;
            }
            return {
                ...state,
                phase: "reveal",
                skipped: state.skipped + 1,
                boardFen: expected.fen,
                lastMoveUci: expected.uci,
                feedback: {
                    outcome: "skipped",
                    expectedSan: expected.san,
                    playedSan: null,
                },
            };
        }
        case "advance": {
            if (state.phase !== "reveal") {
                return state;
            }
            const next = advanceIndex(state.moves, state.index, state.side);
            if (next === null) {
                return {
                    ...state,
                    phase: "finished",
                    feedback: null,
                };
            }
            return {
                ...state,
                phase: "guessing",
                index: next,
                boardFen: state.moves[next - 1].fen,
                lastMoveUci: state.moves[next - 1].uci,
                feedback: null,
            };
        }
        case "reset":
            return initialQuizState;
    }
}
