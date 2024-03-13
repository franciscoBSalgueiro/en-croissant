import { searchPosition } from "./db";
import { isPrefix } from "./misc";
import { type TreeNode, treeIterator } from "./treeReducer";

export type MissingMove = {
  position: number[];
  games: number;
  percentage: number;
  move: string;
};

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

export async function openingReport({
  color,
  start,
  root,
  referenceDb,
  setProgress,
  minimumGames,
  percentageCoverage,
}: {
  color: "white" | "black";
  start: number[];
  root: TreeNode;
  referenceDb: string;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  minimumGames: number;
  percentageCoverage: number;
}): Promise<MissingMove[]> {
  const iterator = treeIterator(root);
  const tree = Array.from(iterator);
  const missingMoves: MissingMove[] = [];
  const ignoredPositions = new Set<number[]>();

  let i = 0;

  for (const item of tree) {
    setProgress((i++ / tree.length) * 100);
    let isIgnored = false;
    for (const p of ignoredPositions) {
      if (isPrefix(p, item.position)) {
        isIgnored = true;
        break;
      }
    }
    if (isIgnored) {
      continue;
    }

    if (
      (color === "white" && item.node.halfMoves % 2 === 0) ||
      (color === "black" && item.node.halfMoves % 2 === 1) ||
      (isPrefix(item.position, start) && item.position.length < start.length)
    ) {
      continue;
    }
    const [openings] = await searchPosition(
      {
        path: referenceDb,
        type: "exact",
        fen: item.node.fen,
        color: "white",
        player: null,
      },
      "opening",
    );
    const total = openings.reduce(
      (acc, opening) => acc + opening.black + opening.white + opening.draw,
      0,
    );

    if (total < minimumGames) {
      ignoredPositions.add(item.position);
      continue;
    }

    const filteredOpenings = openings.filter(
      (opening) =>
        (opening.black + opening.white + opening.draw) / total >
        1 - percentageCoverage / 100,
    );

    // Check if there's any opening with a 5% or more frequency that isn't a child of item.node
    for (const opening of filteredOpenings) {
      const child = item.node.children.find(
        (child) => child.san === opening.move,
      );
      if (!child && opening.move !== "*") {
        missingMoves.push({
          position: item.position,
          move: opening.move,
          games: opening.black + opening.white + opening.draw,
          percentage: (opening.black + opening.white + opening.draw) / total,
        });
      }
    }
  }
  return missingMoves;
}
