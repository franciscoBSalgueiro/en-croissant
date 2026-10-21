import { expect, test } from "vitest";
import {
    BOARD_MARGIN,
    boardSize,
    defaultBoardSplit,
    EVAL_BAR_GAP,
    EVAL_BAR_WIDTH,
} from "../boardLayout";

// Spacing outside the board's pane, as BoardsPage and react-mosaic lay it out
const PANE_MARGIN = 3;
const LEFT_OF_PANE = 10 + PANE_MARGIN;
const ABOVE_AND_BELOW_PANE = 8 + PANE_MARGIN;

test("at its largest the board keeps the margin left of it, above it and below it", () => {
    // A tall enough window on a Retina screen, with the board centred up and down in its pane
    const pane = { width: 2000, height: 760 };
    const board = boardSize(pane, 2);
    const aboveAndBelow = ABOVE_AND_BELOW_PANE + (pane.height - board) / 2;

    expect(LEFT_OF_PANE + EVAL_BAR_WIDTH + EVAL_BAR_GAP).toBe(BOARD_MARGIN);
    expect(aboveAndBelow).toBe(BOARD_MARGIN);
});

test("the eval bar sits centred between the edge of the tab and the board", () => {
    expect(EVAL_BAR_GAP).toBe(LEFT_OF_PANE);
});

test("the board is a whole number of screen pixels per square, so it's drawn at exactly that size", () => {
    // chessground draws squares of whole screen pixels; a board that isn't would be drawn smaller
    // than its box, leaving the eval bar beside it taller than the board
    for (const pixelRatio of [1, 1.5, 2]) {
        const board = boardSize({ width: 2000, height: 777 }, pixelRatio);
        const squarePixels = (board * pixelRatio) / 8;
        expect(squarePixels).toBeCloseTo(Math.round(squarePixels), 9);
        expect(board).toBeGreaterThan(777 - 2 * 40 - 8);
    }
});

test("by default the right-hand column starts the margin away from the board", () => {
    const layout = { width: 1440, height: 766 };
    const split = defaultBoardSplit(layout, 2);

    // The board's pane spans the split's share of the layout less its margin on each side, and the
    // column's pane begins after its own margin
    const paneWidth = (split / 100) * layout.width - 2 * PANE_MARGIN;
    const board = boardSize({ width: paneWidth, height: layout.height - 2 * PANE_MARGIN }, 2);
    const boardRightEdge = EVAL_BAR_WIDTH + EVAL_BAR_GAP + board;
    const columnStart = paneWidth + 2 * PANE_MARGIN;
    expect(columnStart - boardRightEdge).toBeCloseTo(BOARD_MARGIN, 6);
});

test("when the board's pane is narrowed, the board shrinks and keeps the margin to the column", () => {
    const pane = { width: 600, height: 2000 };
    const board = boardSize(pane, 2);
    const toColumn = pane.width - (EVAL_BAR_WIDTH + EVAL_BAR_GAP + board) + 2 * PANE_MARGIN;
    expect(toColumn).toBeGreaterThanOrEqual(BOARD_MARGIN);
    expect(toColumn).toBeLessThan(BOARD_MARGIN + 4);
});
