import { describe, expect, it } from "vitest";
import { agreementArrowShape, getEngineAgreements } from "./engineAgreementArrows";

describe("engine agreement arrows", () => {
    it("counts matching first moves from distinct engines", () => {
        const arrows = new Map([
            [
                0,
                [
                    { pv: ["e2e4"], winChance: 50 },
                    { pv: ["d2d4"], winChance: 49 },
                ],
            ],
            [1, [{ pv: ["e2e4"], winChance: 52 }]],
            [2, [{ pv: ["d2d4"], winChance: 53 }]],
        ]);
        expect(getEngineAgreements(arrows)).toEqual([
            { move: "e2e4", orig: "e2", dest: "e4", colors: ["#003088", "#15781B"] },
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
