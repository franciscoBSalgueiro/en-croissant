import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import { searchPosition } from "./db";
import { getNodeAtPath, type TreeNode, treeIterator, getBoardState } from "./treeReducer";
import { TreeStoreState } from "@/state/store/tree";
import { memoize } from "proxy-memoize";

export type PositionMove = {
    san: string;
    games: number;
    totalGames: number;
    frequency: number;
    white: number;
    draw: number;
    black: number;
    inRepertoire: boolean;
    coverage: number;
    path: number[];
};

export async function fetchPositionMoves(
    dbPath: string,
    fen: string,
): Promise<{
    moves: { move: string; white: number; draw: number; black: number }[];
    total: number;
}> {
    try {
        const [openings] = await searchPosition(
            {
                path: dbPath,
                type: "exact",
                fen,
                color: "white",
                player: null,
                result: "any",
            } as LocalOptions,
            "coverage-calc",
        );
        const summary = openings.find((op) => op.move === "*");
        const moves = openings
            .filter((op) => op.move !== "*")
            .map((op) => ({
                move: op.move,
                white: op.white,
                draw: op.draw,
                black: op.black,
            }));
        const gamesEndingHere = summary ? summary.white + summary.draw + summary.black : 0;
        const gamesContinuing = moves.reduce((acc, m) => acc + m.white + m.draw + m.black, 0);
        return { moves, total: gamesEndingHere + gamesContinuing };
    } catch {
        return { moves: [], total: 0 };
    }
}

type DbCache = Map<
    string,
    {
        moves: { move: string; white: number; draw: number; black: number }[];
        total: number;
    }
>;

async function buildDbCache(root: TreeNode, startPath: number[], dbPath: string): Promise<DbCache> {
    const startNode = startPath.length > 0 ? getNodeAtPath(root, startPath) : root;

    const fenSet = new Set<string>();
    const stack: TreeNode[] = [startNode];
    while (stack.length > 0) {
        const node = stack.pop()!;
        fenSet.add(getBoardState(node.fen));
        for (const child of node.children) stack.push(child);
    }
    const fenList = [...fenSet];

    const cache: DbCache = new Map();

    for (let i = 0; i < fenList.length; i++) {
        const fen = fenList[i];
        const data = await fetchPositionMoves(dbPath, fen);

        const enrichedMoves = data.moves.map((m) => ({
            move: m.move,
            white: m.white,
            draw: m.draw,
            black: m.black,
        }));
        const total = data.total;
        cache.set(fen, { moves: enrichedMoves, total });
    }
    return cache;
}

/**
 * Compute coverage and missing games for a single board FEN.
 * Recurses into child FENs (which must already be in dbCache and stateMoves).
 * Results are stored in a Map so each FEN is processed only once.
 */
function computeCoverageForFen(
    fen: string,
    dbCache: DbCache,
    stateMoves: Map<string, Map<string, string>>,
    orientation: "white" | "black",
    minGames: number,
    memo: Map<string, { coverage: number; missing: number }>,
): { coverage: number; missing: number } {
    const cached = memo.get(fen);
    if (cached) return cached;

    const dbData = dbCache.get(fen);
    const moves = dbData?.moves ?? [];
    const total = dbData?.total ?? 0;

    if (total < minGames) {
        const res = { coverage: 1, missing: 0 };
        memo.set(fen, res);
        return res;
    }

    const sideToMove = fen.split(" ")[1]; // "w" or "b"
    const isUserTurn = sideToMove === orientation[0];

    if (isUserTurn) {
        const childFenMap = stateMoves.get(fen);
        if (!childFenMap || childFenMap.size === 0) {
            const res = { coverage: 0, missing: total };
            memo.set(fen, res);
            return res;
        }
        let maxCoverage = 0;
        for (const childFen of childFenMap.values()) {
            const child = computeCoverageForFen(
                childFen,
                dbCache,
                stateMoves,
                orientation,
                minGames,
                memo,
            );
            maxCoverage = Math.max(maxCoverage, child.coverage);
        }
        const res = { coverage: maxCoverage, missing: 0 };
        memo.set(fen, res);
        return res;
    } else {
        // Opponent's turn
        const significant = moves.filter((m) => m.white + m.draw + m.black >= minGames);
        const sigTotal = significant.reduce((sum, m) => sum + m.white + m.draw + m.black, 0);
        if (sigTotal === 0) {
            const res = { coverage: 1, missing: 0 };
            memo.set(fen, res);
            return res;
        }
        let weighted = 0;
        let maxMissing = 0;
        for (const m of significant) {
            const freq = (m.white + m.draw + m.black) / sigTotal;
            const childFen = stateMoves.get(fen)?.get(m.move);
            if (childFen) {
                const child = computeCoverageForFen(
                    childFen,
                    dbCache,
                    stateMoves,
                    orientation,
                    minGames,
                    memo,
                );
                weighted += freq * child.coverage;
            } else {
                if (m.white + m.draw + m.black > maxMissing) {
                    maxMissing = m.white + m.draw + m.black;
                }
            }
        }
        const res = { coverage: weighted, missing: maxMissing };
        memo.set(fen, res);
        return res;
    }
}

/**
 * Walk the actual tree and build the path‑keyed maps needed by the UI.
 */
function buildPathMaps(
    root: TreeNode,
    startPath: number[],
    fenCoverageCache: Map<string, { coverage: number; missing: number }>,
    dbCache: DbCache,
): {
    coverageMap: Map<string, number>;
    gamesMap: Map<string, number>;
    missingGamesMap: Map<string, number>;
    dbMovesMap: Map<
        string,
        { moves: { move: string; white: number; draw: number; black: number }[]; total: number }
    >;
} {
    const coverageMap = new Map<string, number>();
    const gamesMap = new Map<string, number>();
    const missingGamesMap = new Map<string, number>();
    const dbMovesMap = new Map<
        string,
        { moves: { move: string; white: number; draw: number; black: number }[]; total: number }
    >();

    const startNode = startPath.length > 0 ? getNodeAtPath(root, startPath) : root;
    function walk(node: TreeNode, path: number[]) {
        const boardFen = getBoardState(node.fen);
        const fenData = fenCoverageCache.get(boardFen);
        if (fenData) {
            const key = path.join(",");
            coverageMap.set(key, fenData.coverage);
            missingGamesMap.set(key, fenData.missing);
        }
        const dbData = dbCache.get(boardFen);
        if (dbData) {
            const key = path.join(",");
            gamesMap.set(key, dbData.total);
            if (!dbMovesMap.has(boardFen)) {
                dbMovesMap.set(boardFen, dbData);
            }
        }
        for (let i = 0; i < node.children.length; i++) {
            walk(node.children[i], [...path, i]);
        }
    }
    walk(startNode, [...startPath]);

    return { coverageMap, gamesMap, missingGamesMap, dbMovesMap };
}

export async function computeTreeCoverage(
    root: TreeNode,
    userColor: "white" | "black",
    dbPath: string,
    minGames: number,
    startPath: number[],
    stateMoves: Map<string, Map<string, string>>,
): Promise<{
    coverageMap: Map<string, number>;
    gamesMap: Map<string, number>;
    missingGamesMap: Map<string, number>;
    dbMovesMap: Map<
        string,
        { moves: { move: string; white: number; draw: number; black: number }[]; total: number }
    >;
}> {
    const dbCache = await buildDbCache(root, startPath, dbPath);

    const memo = new Map<string, { coverage: number; missing: number }>();
    let computedCount = 0;
    for (const fen of dbCache.keys()) {
        computeCoverageForFen(fen, dbCache, stateMoves, userColor, minGames, memo);
        computedCount++;
    }

    const pathMaps = buildPathMaps(root, startPath, memo, dbCache);

    return pathMaps;
}

export function findNextGap(
    root: TreeNode,
    startPath: number[],
    userColor: "white" | "black",
    coverageMap: Map<string, number>,
    gamesMap: Map<string, number>,
    minGames: number,
): number[] | null {
    const userParity = userColor === "white" ? 0 : 1;
    const startNode = getNodeAtPath(root, startPath);

    function findNextInSubtree(node: TreeNode, path: number[]): number[] | null {
        const pathKey = path.join(",");
        const coverage = coverageMap.get(pathKey) ?? 0;
        const games = gamesMap.get(pathKey) ?? 0;

        if (coverage >= 1 || games < minGames) {
            return null;
        }

        const isUserTurn = node.halfMoves % 2 === userParity;

        for (let i = 0; i < node.children.length; i++) {
            const result = findNextInSubtree(node.children[i], [...path, i]);
            if (result) return result;
        }

        if (path.length > startPath.length) {
            if (isUserTurn && node.children.length === 0) {
                return path;
            }

            if (!isUserTurn) {
                return path;
            }
        }

        return null;
    }

    return findNextInSubtree(startNode, startPath);
}

export function findBiggestGap(
    root: TreeNode,
    userColor: "white" | "black",
    coverageMap: Map<string, number>,
    gamesMap: Map<string, number>,
    missingGamesMap: Map<string, number>,
    minGames: number,
    startPath: number[] = [],
): number[] | null {
    const userParity = userColor === "white" ? 0 : 1;
    const startNode = getNodeAtPath(root, startPath);

    let maxMissing = -1;
    let bestPath: number[] | null = null;

    function traverse(node: TreeNode, path: number[]): boolean {
        const pathKey = path.join(",");
        const coverage = coverageMap.get(pathKey) ?? 0;
        const games = gamesMap.get(pathKey) ?? 0;
        const missing = missingGamesMap.get(pathKey) ?? 0;

        if (coverage >= 1 || games < minGames) {
            return false;
        }

        const isUserTurn = node.halfMoves % 2 === userParity;

        let childHasGap = false;
        for (let i = 0; i < node.children.length; i++) {
            const hasGap = traverse(node.children[i], [...path, i]);
            if (hasGap) {
                childHasGap = true;
            }
        }

        if (path.length > startPath.length) {
            let isGap = false;
            if (isUserTurn && node.children.length === 0) {
                isGap = true;
            } else if (!isUserTurn && !childHasGap) {
                isGap = true;
            }

            if (isGap) {
                if (missing > maxMissing) {
                    maxMissing = missing;
                    bestPath = [...path];
                } else if (missing === maxMissing && bestPath !== null) {
                    if (path.length < bestPath.length) {
                        bestPath = [...path];
                    }
                }
            }
        }

        return true;
    }

    traverse(startNode, startPath);
    return bestPath;
}

function getTreeStats(root: TreeNode) {
    const iterator = treeIterator(root);
    const tree = Array.from(iterator);
    const total = tree.length - 1;
    const leafs = tree.filter((item) => item.node.children.length === 0).length;
    const depth = tree.reduce((acc, item) => {
        if (item.position.length > acc) {
            return item.position.length;
        }
        return acc;
    }, 0);
    return { total, leafs, depth };
}

export const getStats = memoize((store: TreeStoreState) => getTreeStats(store.root));
