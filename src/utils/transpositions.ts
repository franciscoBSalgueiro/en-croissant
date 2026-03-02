import { hasMorePriority, stripClock } from "@/utils/chess";
import { type TreeNode, treeIterator } from "@/utils/treeReducer";

const transpositionCache = new WeakMap<TreeNode, Map<string, number[][]>>();

function getTranspositionMap(root: TreeNode) {
  if (transpositionCache.has(root)) {
    return transpositionCache.get(root)!;
  }

  const map = new Map<string, number[][]>();
  const iterator = treeIterator(root);

  for (const item of iterator) {
    const strippedFen = stripClock(item.node.fen);
    if (!map.has(strippedFen)) {
      map.set(strippedFen, []);
    }
    map.get(strippedFen)!.push(item.position);
  }

  transpositionCache.set(root, map);
  return map;
}

export function getTranspositions(
  fen: string,
  position: number[],
  root: TreeNode,
) {
  if (position.length === 0 || position.every((v) => v === 0)) return [];

  const map = getTranspositionMap(root);
  const strippedFen = stripClock(fen);

  const matchingPositions = map.get(strippedFen) || [];

  return matchingPositions.filter(
    (targetPosition) => !hasMorePriority(position, targetPosition),
  );
}
