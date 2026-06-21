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

interface BoardCoverageInput {
    dbMoves: { move: string; games: number }[];
    total: number;
    minGames: number;
    isUserTurn: boolean;
    movesMap: Map<string, string>; // SAN → next board FEN
    getChildCoverage: (nextFen: string) => Promise<{ coverage: number; missing: number }>;
}

async function computeBoardCoverage(
    input: BoardCoverageInput,
): Promise<{ coverage: number; missing: number }> {
    const { dbMoves, total, minGames, isUserTurn, movesMap, getChildCoverage } = input;

    if (total < minGames) {
        return { coverage: 1, missing: 0 };
    }

    if (isUserTurn) {
        if (movesMap.size === 0) {
            return { coverage: 0, missing: total };
        }
        let maxCoverage = 0;
        for (const nextFen of movesMap.values()) {
            const { coverage } = await getChildCoverage(nextFen);
            maxCoverage = Math.max(maxCoverage, coverage);
        }
        return { coverage: maxCoverage, missing: 0 };
    }

    // Opponent’s turn
    const significant = dbMoves.filter((m) => m.games >= minGames);
    const sigTotal = significant.reduce((sum, m) => sum + m.games, 0);
    if (sigTotal === 0) {
        return { coverage: 1, missing: 0 };
    }

    let weighted = 0;
    let maxMissing = 0;
    for (const m of significant) {
        const freq = m.games / sigTotal;
        if (movesMap.has(m.move)) {
            const { coverage } = await getChildCoverage(movesMap.get(m.move)!);
            weighted += freq * coverage;
        } else if (m.games > maxMissing) {
            maxMissing = m.games;
        }
    }
    return { coverage: weighted, missing: maxMissing };
}

function createCoverageCalculator(
    dbPath: string,
    minGames: number,
    orientation: "white" | "black",
    stateMoves: Map<string, Map<string, string>>,
) {
    const dbCache = new Map<
        string,
        Promise<{
            moves: { move: string; white: number; draw: number; black: number }[];
            total: number;
        }>
    >();
    const boardCache = new Map<string, Promise<{ coverage: number; missing: number }>>();
    const computing = new Set<string>();

    const getDbMoves = (
        fen: string,
    ): Promise<{
        moves: { move: string; white: number; draw: number; black: number }[];
        total: number;
    }> => {
        if (!dbCache.has(fen)) dbCache.set(fen, fetchPositionMoves(dbPath, fen));
        return dbCache.get(fen)!;
    };

    const computeBoardStateCoverage = async (
        boardFen: string,
    ): Promise<{ coverage: number; missing: number }> => {
        if (boardCache.has(boardFen)) return boardCache.get(boardFen)!;
        if (computing.has(boardFen)) {
            return { coverage: 1, missing: 0 };
        }

        computing.add(boardFen);
        const promise = (async () => {
            try {
                const { moves: enrichedMoves, total } = await getDbMoves(boardFen);
                const dbMoves = enrichedMoves.map((m) => ({
                    move: m.move,
                    games: m.white + m.draw + m.black,
                }));
                const sideToMove = boardFen.split(" ")[1];
                const isUserTurn = sideToMove === orientation[0];
                const movesMap = stateMoves.get(boardFen) ?? new Map();

                return computeBoardCoverage({
                    dbMoves,
                    total,
                    minGames,
                    isUserTurn,
                    movesMap,
                    getChildCoverage: computeBoardStateCoverage,
                });
            } finally {
                computing.delete(boardFen);
            }
        })();

        boardCache.set(boardFen, promise);
        return promise;
    };

    return { computeBoardStateCoverage, getDbMoves };
}

async function populateCoverageMaps(
    root: TreeNode,
    startPath: number[],
    calculator: ReturnType<typeof createCoverageCalculator>,
) {
    const coverageMap = new Map<string, number>();
    const gamesMap = new Map<string, number>();
    const missingMap = new Map<string, number>();
    const dbMovesMap = new Map<
        string,
        { moves: { move: string; white: number; draw: number; black: number }[]; total: number }
    >();

    async function walk(node: TreeNode, path: number[]) {
        const boardFen = getBoardState(node.fen);
        const { coverage, missing } = await calculator.computeBoardStateCoverage(boardFen);
        const { moves, total } = await calculator.getDbMoves(boardFen);
        const key = path.join(",");

        coverageMap.set(key, coverage);
        missingMap.set(key, missing);
        gamesMap.set(key, total);
        dbMovesMap.set(boardFen, { moves, total });

        for (let i = 0; i < node.children.length; i++) {
            await walk(node.children[i], [...path, i]);
        }
    }

    const startNode = getNodeAtPath(root, startPath);
    if (startNode) await walk(startNode, startPath);

    return { coverageMap, gamesMap, missingGamesMap: missingMap, dbMovesMap };
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
    const calculator = createCoverageCalculator(dbPath, minGames, userColor, stateMoves);
    return populateCoverageMaps(root, startPath, calculator);
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
