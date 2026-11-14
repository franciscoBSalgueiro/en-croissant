import { Chess } from "chessops/chess";
import { makeFen, parseFen } from "chessops/fen";
import { describe, expect, it, vi } from "vitest";
import { getEngineArrowShapes } from "./engineArrowShapes";

// Keep the helper test independent of the analysis panel's desktop UI imports.
vi.mock("../panels/analysis/BestMoves", () => ({
    arrowColors: [
        { strong: "blue", pale: "paleBlue" },
        { strong: "green", pale: "paleGreen" },
        { strong: "red", pale: "paleRed" },
        { strong: "yellow", pale: "yellow" },
    ],
}));

const arrowsFor = (pv: string[]) => new Map([[0, [{ pv, winChance: 50 }]]]);

describe("engine arrow search position", () => {
    it.each([
        { turn: "white", move: "e2e4" },
        { turn: "black", move: "e7e5" },
    ] as const)("renders normal $turn analysis without changing the board", ({ turn, move }) => {
        const pos = Chess.default();
        pos.turn = turn;
        const before = makeFen(pos.toSetup());
        const shapes = getEngineArrowShapes({
            arrows: arrowsFor([move]),
            pos,
            showConsecutiveArrows: false,
        });
        expect(shapes).toEqual([
            {
                orig: move.slice(0, 2),
                dest: move.slice(2, 4),
                brush: "blue",
                modifiers: { lineWidth: 11 },
            },
        ]);
        expect(makeFen(pos.toSetup())).toBe(before);
    });

    it.each([
        { turn: "white", pv: ["e7e5", "a2a3", "e5e4", "a3a4", "e4e3"] },
        { turn: "black", pv: ["e2e4", "a7a6", "e4e5", "a6a5", "e5e6"] },
    ] as const)(
        "renders the opponent's threat and continuations on $turn's turn",
        ({ turn, pv }) => {
            const pos = Chess.default();
            pos.turn = turn;
            const before = makeFen(pos.toSetup());
            expect(
                getEngineArrowShapes({
                    arrows: arrowsFor([...pv]),
                    pos,
                    showConsecutiveArrows: true,
                }),
            ).toEqual([]);
            const shapes = getEngineArrowShapes({
                arrows: arrowsFor([...pv]),
                pos,
                showConsecutiveArrows: true,
                threat: true,
            });
            expect(shapes.map(({ orig, dest }) => `${orig}${dest}`)).toEqual([pv[0], pv[2], pv[4]]);
            expect(makeFen(pos.toSetup())).toBe(before);
        },
    );

    it.each([
        { fen: "k3r3/8/8/8/8/8/8/4K3 w - - 0 1", escape: "e1d1", opponentMove: "a8b8" },
        { fen: "4k3/8/8/8/8/8/8/K3R3 b - - 0 1", escape: "e8d8", opponentMove: "a1b1" },
    ])(
        "keeps the real turn when threat analysis is suppressed in check: $escape",
        ({ fen, escape, opponentMove }) => {
            const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
            expect(pos.isCheck()).toBe(true);
            const shapes = getEngineArrowShapes({
                arrows: arrowsFor([escape]),
                pos,
                showConsecutiveArrows: false,
                threat: true,
            });
            expect(shapes.map(({ orig, dest }) => `${orig}${dest}`)).toEqual([escape]);
            expect(
                getEngineArrowShapes({
                    arrows: arrowsFor([opponentMove]),
                    pos,
                    showConsecutiveArrows: false,
                    threat: true,
                }),
            ).toEqual([]);
            expect(makeFen(pos.toSetup())).toBe(fen);
        },
    );

    it.each([false, true])(
        "still rejects malformed and illegal candidates with threat=%s",
        (threat) => {
            for (const move of ["invalid", "e2e5", "e7e4"]) {
                expect(
                    getEngineArrowShapes({
                        arrows: arrowsFor([move]),
                        pos: Chess.default(),
                        showConsecutiveArrows: true,
                        threat,
                    }),
                ).toEqual([]);
            }
        },
    );

    it("stops before an illegal continuation", () => {
        const shapes = getEngineArrowShapes({
            arrows: arrowsFor(["e7e5", "e2e5", "e5e4"]),
            pos: Chess.default(),
            showConsecutiveArrows: true,
            threat: true,
        });
        expect(shapes.map(({ orig, dest }) => `${orig}${dest}`)).toEqual(["e7e5"]);
    });
});
