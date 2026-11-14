import { useCallback, useContext, useEffect, useRef } from "react";
import { kingCastlesTo, makeUci, type Chess, type Move, type Role } from "chessops";
import { makeBoardFen } from "chessops/fen";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { positionFromFen } from "@/utils/chessops";
import { diffLeds, onBoardPosition, setBoardLeds } from "@/utils/smartboard";
import { getNodeAtPath } from "@/utils/treeReducer";

const PROMOTION_ROLES: Role[] = ["queen", "rook", "bishop", "knight"];
const ZERO_LEDS = [0, 0, 0, 0, 0, 0, 0, 0];

/**
 * Builds the candidate move(s) for a legal (from, to) pair.
 *
 * `allDests()` lists castling as king → *rook* square (e1 → h1) but the rest
 * of the app (and `makeUci`) uses king → target square (e1 → g1), so castling
 * is normalized to the target. Pawns reaching the last rank get one candidate
 * per promotion role (a plain pawn move is not legal there).
 */
function candidateMoves(pos: Chess, from: number, to: number): Move[] {
    const piece = pos.board.get(from);
    if (!piece) return [];

    if (piece.role === "king") {
        const rook = pos.castles.rook[pos.turn];
        const target =
            to === rook.h
                ? kingCastlesTo(pos.turn, "h")
                : to === rook.a
                  ? kingCastlesTo(pos.turn, "a")
                  : to;
        return [{ from, to: target }];
    }

    if (piece.role === "pawn") {
        const isLastRank = pos.turn === "white" ? to >= 56 : to < 8;
        if (isLastRank) {
            return PROMOTION_ROLES.map((promotion) => ({ from, to, promotion }));
        }
    }

    return [{ from, to }];
}

/**
 * Applies smart-board input to the tree of the mounted board and keeps the
 * board LEDs in sync with the disagreement between the physical board and the
 * position shown in the app.
 *
 * Only the active tab keeps its board mounted (Mantine `keepMounted={false}`),
 * so at most one instance of this hook is live at a time.
 *
 * LEDs: whenever the two placements differ, the squares that differ light up
 * (both when the user moves a piece on the physical board and when the app
 * position changes, e.g. the engine plays). When they match, the LEDs are
 * cleared. Writes are deduplicated so the BLE write only happens when the LED
 * pattern actually changes.
 *
 * Move input (only while `enabled`): a position from the physical board is
 * accepted when it is reachable from the current position by exactly one legal
 * move (regular moves, captures, castling, en passant, promotions); that move
 * is played through `applyMove`. Otherwise, when `applyPosition` is provided
 * (position editing), a legal board placement is applied directly.
 */
export function useSmartBoardInput(params: {
    enabled: boolean;
    applyMove: (uci: string, move: Move) => void;
    applyPosition?: (placement: string) => void;
}) {
    const { enabled, applyMove, applyPosition } = params;

    const store = useContext(TreeStateContext)!;
    const rootNode = useStore(store, (s) => s.root);
    const position = useStore(store, (s) => s.position);

    const node = getNodeAtPath(rootNode, position);
    const [appPos] = node ? positionFromFen(node.fen) : [null];
    const appPlacement = appPos ? makeBoardFen(appPos.board) : null;

    // Placement reported by the physical board on its last frame.
    const lastBoardPlacementRef = useRef<string | null>(null);
    // Last LED pattern sent, to dedupe BLE writes.
    const lastLedsRef = useRef<number[] | null>(null);

    const updateLeds = useCallback((app: string | null, board: string | null) => {
        if (!app || !board) return;
        const leds = app === board ? ZERO_LEDS : diffLeds(app, board);
        const prev = lastLedsRef.current;
        if (prev && prev.every((v, i) => v === leds[i])) return;
        lastLedsRef.current = leds;
        void setBoardLeds(leds);
    }, []);

    // App → board: when the app position changes (engine move, navigation,
    // editing), light the squares the physical board still shows differently.
    useEffect(() => {
        updateLeds(appPlacement, lastBoardPlacementRef.current);
    }, [appPlacement, updateLeds]);

    useEffect(() => {
        return onBoardPosition((event) => {
            const placement = event.placement;
            lastBoardPlacementRef.current = placement;
            // Light up the disagreement (or clear it when the boards match).
            updateLeds(appPlacement, placement);

            if (!enabled || !node || appPlacement === placement) return;

            const [pos] = positionFromFen(node.fen);
            if (!pos) return;

            // Find the legal move from the current position that produces the
            // placement reported by the board. `allDests` only contains legal
            // moves, and `play` blindly applies what it is given, so candidate
            // moves must always be built from it. Once the move is applied the
            // app catches up and the app→board effect clears the LEDs.
            for (const [from, toSet] of pos.allDests().entries()) {
                for (const to of toSet) {
                    for (const move of candidateMoves(pos, from, to)) {
                        const clone = pos.clone();
                        clone.play(move);
                        if (makeBoardFen(clone.board) === placement) {
                            applyMove(makeUci(move), move);
                            return;
                        }
                    }
                }
            }

            // Not a single legal move: treat it as a position setup.
            if (applyPosition) {
                const [setupPos] = positionFromFen(placement + " w - 0 1");
                if (setupPos) {
                    applyPosition(placement);
                }
            }
        });
    }, [enabled, node, appPlacement, applyMove, applyPosition, updateLeds]);
}
