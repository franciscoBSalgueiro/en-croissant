import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import { searchPosition } from "./db";
import { getNodeAtPath, type TreeNode, treeIterator } from "./treeReducer";

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
  childIndex: number;
};

export async function computeTreeCoverage(
  root: TreeNode,
  userColor: "white" | "black",
  dbPath: string,
  minGames: number,
  startPath: number[] = [],
): Promise<{
  coverageMap: Map<string, number>;
  gamesMap: Map<string, number>;
}> {
  const userParity = userColor === "white" ? 0 : 1;
  const coverageMap = new Map<string, number>();
  const gamesMap = new Map<string, number>();
  const fenCoverageCache = new Map<string, Promise<number>>();

  async function getDbMoves(
    fen: string,
  ): Promise<{ moves: { move: string; games: number }[]; total: number }> {
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
          games: op.white + op.draw + op.black,
        }));

      const gamesEndingHere = summary
        ? summary.white + summary.draw + summary.black
        : 0;

      const gamesContinuing = moves.reduce((acc, m) => acc + m.games, 0);

      const total = gamesEndingHere + gamesContinuing;

      return { moves, total };
    } catch {
      return { moves: [], total: 0 };
    }
  }

  async function compute(node: TreeNode, path: number[]): Promise<number> {
    const pathKey = path.join(",");

    if (node.children.length === 0 && fenCoverageCache.has(node.fen)) {
      const transpositionCoverage = await fenCoverageCache.get(node.fen)!;
      coverageMap.set(pathKey, transpositionCoverage);
      const { total: totalGames } = await getDbMoves(node.fen);
      gamesMap.set(pathKey, totalGames);
      return transpositionCoverage;
    }

    if (node.children.length > 0 && !fenCoverageCache.has(node.fen)) {
      const promise = computeNode(node, path);
      fenCoverageCache.set(node.fen, promise);
      return promise;
    }

    return computeNode(node, path);
  }

  async function computeNode(node: TreeNode, path: number[]): Promise<number> {
    const pathKey = path.join(",");

    const { moves: dbMoves, total: totalGames } = await getDbMoves(node.fen);
    gamesMap.set(pathKey, totalGames);

    if (totalGames < minGames) {
      coverageMap.set(pathKey, 1);
      return 1;
    }

    const isOpponentTurn = node.halfMoves % 2 !== userParity;

    if (isOpponentTurn) {
      if (node.children.length === 0) {
        const partialCoverage = Math.min(minGames / totalGames, 1);
        coverageMap.set(pathKey, partialCoverage);
        return partialCoverage;
      }
      const significantMoves = dbMoves.filter((m) => m.games >= minGames);
      const significantTotal = significantMoves.reduce(
        (acc, m) => acc + m.games,
        0,
      );

      if (significantTotal === 0) {
        coverageMap.set(pathKey, 1);
        return 1;
      }

      let coverage = 0;
      for (const dbMove of significantMoves) {
        const childIdx = node.children.findIndex((c) => c.san === dbMove.move);
        if (childIdx !== -1) {
          const frequency = dbMove.games / significantTotal;
          const childCoverage = await compute(node.children[childIdx], [
            ...path,
            childIdx,
          ]);
          coverage += frequency * childCoverage;
        }
      }
      coverageMap.set(pathKey, coverage);
      return coverage;
    }
    if (node.children.length === 0) {
      coverageMap.set(pathKey, 0);
      return 0;
    }
    const childCoverage = await compute(node.children[0], [...path, 0]);
    coverageMap.set(pathKey, childCoverage);
    return childCoverage;
  }

  const startNode = getNodeAtPath(root, startPath);
  await compute(startNode, startPath);
  return { coverageMap, gamesMap };
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
  minGames: number,
  startPath: number[] = [],
): number[] | null {
  const userParity = userColor === "white" ? 0 : 1;
  const startNode = getNodeAtPath(root, startPath);

  const queue: { node: TreeNode; path: number[] }[] = [
    { node: startNode, path: startPath },
  ];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const { node, path } = item;
    const pathKey = path.join(",");
    const coverage = coverageMap.get(pathKey) ?? 0;
    const games = gamesMap.get(pathKey) ?? 0;

    if (coverage >= 1 || games < minGames) {
      continue;
    }

    const isUserTurn = node.halfMoves % 2 === userParity;

    if (path.length > startPath.length) {
      if (isUserTurn && node.children.length === 0) {
        return path;
      }

      if (!isUserTurn) {
        return path;
      }
    }

    for (let i = 0; i < node.children.length; i++) {
      queue.push({ node: node.children[i], path: [...path, i] });
    }
  }

  return null;
}

export function getTreeStats(root: TreeNode) {
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
