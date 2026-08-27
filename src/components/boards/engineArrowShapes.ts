import type { DrawShape } from "@lichess-org/chessground/draw";
import { makeSquare, type NormalMove, parseUci } from "chessops";
import type { Position } from "chessops/chess";
import { match } from "ts-pattern";
import { arrowColors } from "../panels/analysis/BestMoves";

const LARGE_BRUSH = 11;
const MEDIUM_BRUSH = 7.5;
const SMALL_BRUSH = 4;

export function getEngineArrowShapes({
    arrows,
    pos,
    showConsecutiveArrows,
}: {
    arrows: Map<number, { pv: string[]; winChance: number }[]>;
    pos: Position;
    showConsecutiveArrows: boolean;
}): DrawShape[] {
    const shapes: DrawShape[] = [];
    const entries = Array.from(arrows.entries()).sort((a, b) => a[0] - b[0]);

    for (const [i, moves] of entries) {
        if (i >= 4 || moves.length === 0) continue;

        const bestWinChance = moves[0].winChance;
        for (const [j, { pv, winChance }] of moves.entries()) {
            const posClone = pos.clone();
            let prevSquare = null;

            for (const [ii, uci] of pv.entries()) {
                const move = parseUci(uci);
                if (!move || !posClone.isLegal(move)) break;

                posClone.play(move);
                const normalMove = move as NormalMove;
                const from = makeSquare(normalMove.from)!;
                const to = makeSquare(normalMove.to)!;
                if (prevSquare === null) prevSquare = from;

                const brushSize = match(bestWinChance - winChance)
                    .when(
                        (difference) => difference < 2.5,
                        () => LARGE_BRUSH,
                    )
                    .when(
                        (difference) => difference < 5,
                        () => MEDIUM_BRUSH,
                    )
                    .otherwise(() => SMALL_BRUSH);

                if (ii !== 0 && !(showConsecutiveArrows && j === 0 && ii % 2 === 0)) continue;

                if (
                    ii < 5 &&
                    !shapes.some((shape) => shape.orig === from && shape.dest === to) &&
                    prevSquare === from
                ) {
                    shapes.push({
                        orig: from,
                        dest: to,
                        brush: j === 0 ? arrowColors[i].strong : arrowColors[i].pale,
                        modifiers: { lineWidth: brushSize },
                    });
                    prevSquare = to;
                } else {
                    break;
                }
            }
        }
    }

    return shapes;
}
