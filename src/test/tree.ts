import { createTreeStore, type TreeStoreState } from "@/state/store/tree";
import type { TreeState } from "@/utils/treeReducer";

/**
 * Builds a game tree with the tree store actions, since `parsePGN` needs the Rust PGN lexer.
 * The new moves go after the current position, so `goToMove` before `makeMoves` adds a variation.
 *
 * @example
 * buildTree((s) => {
 *     s.makeMoves({ payload: ["e4", "e5", "Nf3"] });
 *     s.goToMove([0]);
 *     s.makeMoves({ payload: ["c5"] }); // 1. e4 e5 (1... c5) 2. Nf3
 * });
 */
export function buildTree(build: (actions: TreeStoreState) => void): TreeState {
    const store = createTreeStore();
    // The actions read the latest state themselves, so one snapshot is enough to call them
    build(store.getState());
    const { root, headers, position, dirty, report } = store.getState();
    return { root, headers, position, dirty, report };
}
