import { describe, expect, it } from "vitest";
import { compactBoardLayout, resizeCompactPanels } from "../boardLayout";

describe("compact board layout", () => {
    it("keeps the first lower panel directly below the board", () => {
        const layout = compactBoardLayout(487, { topRight: 340, bottomRight: 920 });
        expect((layout.height * layout.boardPercentage) / 100).toBeCloseTo(487);
        expect(layout.height).toBe(1747);
    });

    it("preserves page height and board position throughout repeated resizing", () => {
        let panels = { topRight: 340, bottomRight: 680 };
        for (const percentage of [50, 5, 95, 1, 99, 30, 70, 0, 100, 50]) {
            const before = compactBoardLayout(500, panels);
            panels = resizeCompactPanels(before.panelsHeight, percentage);
            const after = compactBoardLayout(500, panels);
            expect(after.height).toBe(before.height);
            expect(after.boardPercentage).toBe(before.boardPercentage);
            expect(panels.topRight).toBeGreaterThanOrEqual(100);
            expect(panels.bottomRight).toBeGreaterThanOrEqual(100);
        }
    });

    it("adds content height without multiplying the whole page", () => {
        const before = compactBoardLayout(500, { topRight: 340, bottomRight: 340 });
        const after = compactBoardLayout(500, { topRight: 440, bottomRight: 340 });
        expect(after.height - before.height).toBe(100);
        expect((after.height * after.boardPercentage) / 100).toBeCloseTo(500);
    });
});
