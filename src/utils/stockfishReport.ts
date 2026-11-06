// Game report ("Generate report") with the built-in Stockfish 19 – the
// WebAssembly counterpart of the backend's `analyze_game`, for iOS where no
// engine programs can run.

import { type Move, parseUci, type Position, type Role } from "chessops";
import { events, type GoMode, type MoveAnalysis } from "@/bindings";
import { positionFromFen } from "./chessops";
import { stockfishAnalysePosition, stockfishPlayStop } from "./stockfish";

const PIECE_VALUE: Record<Role, number> = {
    pawn: 90,
    knight: 300,
    bishop: 300,
    rook: 500,
    queen: 1000,
    king: 0,
};
const MIN = -1_000_000_000;
const MAX = 1_000_000_000;

function countMaterial(pos: Position): number {
    if (pos.isCheckmate()) return -10000;
    let white = 0;
    let black = 0;
    for (const sq of pos.board.occupied) {
        const p = pos.board.get(sq)!;
        if (p.color === "white") white += PIECE_VALUE[p.role];
        else black += PIECE_VALUE[p.role];
    }
    return pos.turn === "white" ? white - black : black - white;
}

function legalMoves(pos: Position): Move[] {
    const moves: Move[] = [];
    for (const [from, dests] of pos.allDests()) {
        const isPawn = pos.board.get(from)?.role === "pawn";
        for (const to of dests) {
            const promo = isPawn && (to >> 3 === 7 || to >> 3 === 0);
            moves.push(promo ? { from, to, promotion: "queen" } : { from, to });
        }
    }
    return moves;
}

function capturedRole(pos: Position, m: Move): Role | undefined {
    if (!("from" in m)) return undefined;
    const target = pos.board.get(m.to);
    if (target && target.color !== pos.turn) return target.role;
    if (pos.board.get(m.from)?.role === "pawn" && m.to === pos.epSquare) return "pawn";
    return undefined;
}

function qsearch(pos: Position, alpha: number, beta: number): number {
    const standPat = countMaterial(pos);
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
    const captures = legalMoves(pos)
        .map((m) => [m, capturedRole(pos, m)] as const)
        .filter(([, r]) => r !== undefined)
        .sort((a, b) => PIECE_VALUE[b[1]!] - PIECE_VALUE[a[1]!]);
    for (const [m] of captures) {
        const next = pos.clone();
        next.play(m);
        const score = -qsearch(next, -beta, -alpha);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

/** Best material outcome for the side to move after a short capture search. */
function naiveEval(pos: Position): number {
    let best = MIN;
    for (const m of legalMoves(pos)) {
        const next = pos.clone();
        next.play(m);
        best = Math.max(best, -qsearch(next, MIN, MAX));
    }
    return best;
}

const cancelled = new Set<string>();

export function cancelBuiltinReport(id: string) {
    cancelled.add(id);
    stockfishPlayStop();
}

export async function builtinAnalyzeGame(
    id: string,
    initialFen: string,
    moves: string[],
    go: GoMode,
    reversed: boolean,
): Promise<MoveAnalysis[]> {
    cancelled.delete(id);
    const [start] = positionFromFen(initialFen);
    if (!start) throw new Error("Invalid FEN");

    // Positions to analyse: the start and every position after a move that isn't game over.
    const positions: { moves: string[]; sacrifice: boolean; pos: Position }[] = [
        { moves: [], sacrifice: false, pos: start.clone() },
    ];
    const pos = start.clone();
    for (let i = 0; i < moves.length; i++) {
        const m = parseUci(moves[i]);
        if (!m) break;
        const previous = pos.clone();
        pos.play(m);
        if (!pos.isEnd()) {
            const prevEval = naiveEval(previous);
            const curEval = -naiveEval(pos);
            positions.push({
                moves: moves.slice(0, i + 1),
                sacrifice: prevEval > curEval + 100,
                pos: pos.clone(),
            });
        }
    }

    const order = positions.map((_, i) => i);
    if (reversed) order.reverse();

    const results: MoveAnalysis[] = positions.map((p) => ({
        best: [],
        novelty: false,
        is_sacrifice: p.sacrifice,
    }));
    const emit = (progress: number, finished: boolean) =>
        void events.progressEvent.emit({ id, progress, finished });

    for (let n = 0; n < order.length; n++) {
        if (cancelled.has(id)) {
            cancelled.delete(id);
            emit(0, true);
            throw new Error("Analysis cancelled");
        }
        emit((n / order.length) * 100, false);
        const i = order[n];
        const legal = legalMoves(positions[i].pos).length;
        results[i].best = (await stockfishAnalysePosition(
            initialFen,
            positions[i].moves,
            go,
            Math.max(1, Math.min(2, legal)),
        )) as MoveAnalysis["best"];
    }
    emit(100, true);
    return results;
}

