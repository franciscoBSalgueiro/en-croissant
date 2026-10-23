import type { MosaicNode } from "react-mosaic-component";

// The analysis, play and puzzle boards keep one margin all around their squares: from the left edge
// of the tab to the squares (past the eval bar), from the tab bar and from the bottom of the window
// to the squares (past the player bars), and, by default, from the squares to the right-hand column.
export const BOARD_MARGIN = 51;

// What lies outside the board's pane, in CSS pixels: the layout's 3px margin around each pane
// (react-mosaic), plus BoardsPage's spacing: the tab's 10px side padding, the 8px under the tab
// bar and the tab's 8px bottom padding
const PANE_MARGIN = 3;
const OUTSIDE_LEFT = 10 + PANE_MARGIN;
const OUTSIDE_TOP_AND_BOTTOM = 8 + PANE_MARGIN;
const BETWEEN_PANES = 2 * PANE_MARGIN;

export const EVAL_BAR_WIDTH = 25;
// The same as the space left of the eval bar, so the bar sits centred in the margin
export const EVAL_BAR_GAP = BOARD_MARGIN - OUTSIDE_LEFT - EVAL_BAR_WIDTH;

// Inside the pane, the room around the squares
export const LEFT_OF_BOARD = EVAL_BAR_WIDTH + EVAL_BAR_GAP;
const ABOVE_AND_BELOW_BOARD = BOARD_MARGIN - OUTSIDE_TOP_AND_BOTTOM;
const RIGHT_OF_BOARD = BOARD_MARGIN - BETWEEN_PANES;

// The largest board that fits its pane with the margin above, below and to its right, made a whole
// number of screen pixels per square: chessground would otherwise shrink the squares it draws to
// that, leaving the eval bar beside them taller than the board
export function boardSize(pane: { width: number; height: number }, pixelRatio: number): number {
    const fits = Math.min(
        pane.height - 2 * ABOVE_AND_BELOW_BOARD,
        pane.width - LEFT_OF_BOARD - RIGHT_OF_BOARD,
    );
    return Math.max(0, (Math.floor((fits * pixelRatio) / 8) * 8) / pixelRatio);
}

// Where the divider between the board and the right-hand column goes until the user drags it, as
// a percentage of the layout's width: so the column starts the margin away from the board
export function defaultBoardSplit(
    layout: { width: number; height: number },
    pixelRatio: number,
): number {
    const board = boardSize(
        { width: Number.POSITIVE_INFINITY, height: layout.height - 2 * PANE_MARGIN },
        pixelRatio,
    );
    const paneWidth = LEFT_OF_BOARD + board + RIGHT_OF_BOARD;
    // A pane takes its share of the layout less its margin on each side
    return ((paneWidth + 2 * PANE_MARGIN) / layout.width) * 100;
}

// What to save when the layout changes. react-mosaic reports all of it, the board's divider
// included even when another divider moved; until the user drags the board's divider, it isn't
// saved, so it stays placed for the window
export function boardLayoutToSave<T extends string>(
    saved: MosaicNode<T> | null,
    shown: MosaicNode<T> | null,
    changed: MosaicNode<T> | null,
): MosaicNode<T> | null {
    if (typeof saved !== "object" || saved === null || saved.splitPercentage !== undefined) {
        return changed;
    }
    if (
        typeof shown !== "object" ||
        shown === null ||
        typeof changed !== "object" ||
        changed === null ||
        changed.splitPercentage !== shown.splitPercentage
    ) {
        return changed;
    }
    const unplaced = { ...changed };
    delete unplaced.splitPercentage;
    return unplaced;
}
