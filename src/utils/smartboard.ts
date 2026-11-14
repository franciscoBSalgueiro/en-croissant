import { commands, events, type BoardPositionEvent, type BoardStatusEvent } from "@/bindings";

type BoardMoveListener = (payload: BoardPositionEvent) => void;
type BoardStatusListener = (payload: BoardStatusEvent) => void;

const moveListeners = new Set<BoardMoveListener>();
const statusListeners = new Set<BoardStatusListener>();

let bridgeInitialized = false;

/**
 * Initializes the global smart-board event bridge (Tauri listeners).
 * Called once from App.
 */
export async function initSmartboardBridge() {
    if (bridgeInitialized) return;
    bridgeInitialized = true;

    await events.boardPositionEvent.listen((event) => {
        moveListeners.forEach((listener) => listener(event.payload));
    });
    await events.boardStatusEvent.listen((event) => {
        statusListeners.forEach((listener) => listener(event.payload));
    });
}

/**
 * Subscribes to smart-board position updates. The listener is only called
 * while `active()` returns true (i.e. while the subscribing board's tab is
 * the visible one). Returns an unsubscribe function.
 */
export function onBoardPosition(listener: BoardMoveListener, active: () => boolean = () => true) {
    const handler = (payload: BoardPositionEvent) => {
        if (active()) {
            listener(payload);
        }
    };
    moveListeners.add(handler);
    return () => {
        moveListeners.delete(handler);
    };
}

/** Subscribes to smart-board connection status changes. */
export function onBoardStatus(listener: BoardStatusListener) {
    statusListeners.add(listener);
    return () => {
        statusListeners.delete(listener);
    };
}

/** Connects to the smart board (optionally by exact device name). */
export function connectBoard(name?: string) {
    return commands.smartboardConnect(name || null);
}

/** Disconnects the smart board. */
export function disconnectBoard() {
    return commands.smartboardDisconnect();
}

/**
 * Sets the board LEDs. `ranks` holds one byte per rank, far rank first
 * (`ranks[0]` = rank 8, `ranks[7]` = rank 1); within a rank byte the file bit
 * for file `f` (0 = `a`) is `1 << (7 - f)`. All-zero bytes clear the LEDs.
 */
export function setBoardLeds(ranks: number[]) {
    return commands.smartboardSetLeds(ranks);
}

/** Expands a FEN placement into a `[row][file]` grid, row 0 = rank 8. */
function expandPlacement(placement: string): string[][] {
    const grid: string[][] = [];
    for (const row of placement.split("/")) {
        const cells: string[] = [];
        for (const ch of row) {
            if (ch >= "1" && ch <= "8") {
                for (let i = 0; i < Number(ch); i++) cells.push("");
            } else {
                cells.push(ch);
            }
        }
        grid.push(cells);
    }
    return grid;
}

/**
 * Builds the 8 LED rank bytes for the squares where the two placements
 * differ. `ranks[0]` = rank 8 … `ranks[7]` = rank 1; within a rank byte the
 * bit for file `f` (0 = `a`) is `1 << (7 - f)`. Returns all zeros when the
 * placements are identical.
 */
export function diffLeds(a: string, b: string): number[] {
    const gridA = expandPlacement(a);
    const gridB = expandPlacement(b);
    const ranks = new Array(8).fill(0);
    for (let row = 0; row < 8; row++) {
        const rowA = gridA[row] ?? [];
        const rowB = gridB[row] ?? [];
        for (let file = 0; file < 8; file++) {
            if (rowA[file] !== rowB[file]) {
                ranks[row] |= 1 << (7 - file);
            }
        }
    }
    return ranks;
}
