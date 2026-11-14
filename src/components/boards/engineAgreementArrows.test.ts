import { describe, expect, it } from "vitest";
import { agreementArrowShape, getEngineAgreements } from "./engineAgreementArrows";

describe("engine agreement arrows", () => {
    it("colors all three Stockfish candidates when they match distinct Maia engines", () => {
        const arrows = new Map([
            [
                0,
                [
                    { pv: ["e2e4"], winChance: 50 },
                    { pv: ["d2d4"], winChance: 49 },
                    { pv: ["g1f3"], winChance: 46 },
                ],
            ],
            [1, [{ pv: ["e2e4"], winChance: 52 }]],
            [2, [{ pv: ["d2d4"], winChance: 53 }]],
            [3, [{ pv: ["g1f3"], winChance: 51 }]],
        ]);
        expect(getEngineAgreements(arrows)).toEqual([
            {
                move: "e2e4",
                orig: "e2",
                dest: "e4",
                colors: ["#003088", "#15781B"],
                opacities: [0.8, 0.8],
            },
            {
                move: "d2d4",
                orig: "d2",
                dest: "d4",
                colors: ["#003088", "#882020"],
                opacities: [0.4, 0.8],
            },
            {
                move: "g1f3",
                orig: "g1",
                dest: "f3",
                colors: ["#003088", "#e68f00"],
                opacities: [0.4, 0.8],
            },
        ]);
    });

    it("counts an engine only once even when its candidate is repeated", () => {
        const arrows = new Map([
            [1, [{ pv: ["d2d4"], winChance: 50 }]],
            [
                0,
                [
                    { pv: ["e2e4"], winChance: 51 },
                    { pv: ["d2d4"], winChance: 50 },
                    { pv: ["d2d4"], winChance: 50 },
                ],
            ],
            [2, [{ pv: ["d2d4"], winChance: 50 }]],
            [3, [{ pv: ["d2d4"], winChance: 50 }]],
        ]);
        expect(getEngineAgreements(arrows)).toEqual([
            {
                move: "d2d4",
                orig: "d2",
                dest: "d4",
                colors: ["#003088", "#15781B", "#882020", "#e68f00"],
                opacities: [0.4, 0.8, 0.8, 0.8],
            },
        ]);
    });

    it("compares secondary candidates from either engine but not continuation moves", () => {
        const arrows = new Map([
            [
                0,
                [
                    { pv: ["e2e4", "e7e5", "g1f3"], winChance: 51 },
                    { pv: ["d2d4"], winChance: 50 },
                ],
            ],
            [
                1,
                [
                    { pv: ["g1f3"], winChance: 51 },
                    { pv: ["d2d4"], winChance: 50 },
                ],
            ],
        ]);
        expect(getEngineAgreements(arrows)).toEqual([
            {
                move: "d2d4",
                orig: "d2",
                dest: "d4",
                colors: ["#003088", "#15781B"],
                opacities: [0.4, 0.4],
            },
        ]);
    });

    it("does not count two PV lines from one engine as agreement", () => {
        const arrows = new Map([
            [
                0,
                [
                    { pv: ["e2e4"], winChance: 50 },
                    { pv: ["e2e4"], winChance: 49 },
                ],
            ],
        ]);
        expect(getEngineAgreements(arrows)).toEqual([]);
    });

    it("keeps the earliest rank for each engine and sorts contributors without Stockfish", () => {
        const arrows = new Map([
            [
                3,
                [
                    { pv: ["d2d4"], winChance: 51 },
                    { pv: ["e2e4"], winChance: 50 },
                ],
            ],
            [
                1,
                [
                    { pv: ["e2e4"], winChance: 51 },
                    { pv: ["e2e4"], winChance: 50 },
                ],
            ],
        ]);
        expect(getEngineAgreements(arrows)).toEqual([
            {
                move: "e2e4",
                orig: "e2",
                dest: "e4",
                colors: ["#15781B", "#e68f00"],
                opacities: [0.8, 0.4],
            },
        ]);
    });

    it("does not treat different promotion pieces as the same candidate", () => {
        const arrows = new Map([
            [0, [{ pv: ["e7e8q"], winChance: 51 }]],
            [1, [{ pv: ["e7e8n"], winChance: 50 }]],
        ]);
        expect(getEngineAgreements(arrows)).toEqual([]);
    });

    it("returns only the first displayed promotion when multiple promotions agree", () => {
        const arrows = new Map([
            [
                1,
                [
                    { pv: ["e7e8q"], winChance: 51 },
                    { pv: ["e7e8n"], winChance: 50 },
                ],
            ],
            [
                0,
                [
                    { pv: ["e7e8n"], winChance: 51 },
                    { pv: ["e7e8q"], winChance: 50 },
                ],
            ],
            [2, [{ pv: ["e7e8q"], winChance: 51 }]],
        ]);
        expect(getEngineAgreements(arrows)).toEqual([
            {
                move: "e7e8n",
                orig: "e7",
                dest: "e8",
                colors: ["#003088", "#15781B"],
                opacities: [0.8, 0.4],
            },
        ]);
    });

    it("does not recolor the displayed promotion for agreement on a different promotion", () => {
        const arrows = new Map([
            [
                0,
                [
                    { pv: ["e7e8n"], winChance: 51 },
                    { pv: ["e7e8q"], winChance: 50 },
                ],
            ],
            [1, [{ pv: ["e7e8q"], winChance: 51 }]],
        ]);
        expect(getEngineAgreements(arrows)).toEqual([]);
    });

    it("renders one clipped, color-segmented shape in either orientation", () => {
        const colors = ["#003088", "#15781B", "#882020"];
        const white = agreementArrowShape("e2", "e4", colors, "white", "boardA");
        const black = agreementArrowShape("e2", "e4", colors, "black", "boardB");
        expect(white.orig).toBe("e2");
        expect(white.dest).toBe("e4");
        expect(white.customSvg?.html).toContain("rotate(-90 50 50)");
        expect(black.customSvg?.html).toContain("rotate(90 50 50)");
        for (const color of colors) expect(white.customSvg?.html).toContain(color);
        expect(white.customSvg?.html).toContain("engine-agreement-boardA-e2-e4");
    });
});
