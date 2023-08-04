import { searchPosition } from "./db";
import { isPrefix } from "./misc";
import { TreeNode, treeIterator } from "./treeReducer";

export type MissingMove = {
    position: number[];
    move: string;
};

export async function openingReport({
    color,
    start,
    root,
    referenceDb,
    setProgress,
}: {
    color: "white" | "black";
    start: number[];
    root: TreeNode;
    referenceDb: string;
    setProgress: React.Dispatch<React.SetStateAction<number>>;
}): Promise<MissingMove[]> {
    const iterator = treeIterator(root);
    const tree = Array.from(iterator);
    const missingMoves: MissingMove[] = [];
    const ignoredPositions = new Set<number[]>();

    let i = 0;

    for (const item of tree) {
        setProgress((i++ / tree.length) * 100);
        for (const p of ignoredPositions) {
            if (isPrefix(p, item.position)) {
                continue;
            }
        }

        if (
            (color === "white" && item.node.halfMoves % 2 === 0) ||
            (color === "black" && item.node.halfMoves % 2 === 1) ||
            isPrefix(item.position, start)
        ) {
            continue;
        }
        const [openings] = await searchPosition(
            referenceDb!,
            "exact",
            item.node.fen
        );
        const total = openings.reduce(
            (acc, opening) =>
                acc + opening.black + opening.white + opening.draw,
            0
        );

        if (total < 5) {
            ignoredPositions.add(item.position);
            continue;
        }

        const filteredOpenings = openings.filter(
            (opening) =>
                (opening.black + opening.white + opening.draw) / total > 0.05
        );

        // Check if there's any opening with a 5% or more frequency that isn't a child of item.node
        for (const opening of filteredOpenings) {
            const child = item.node.children.find(
                (child) => child.move?.san === opening.move
            );
            if (!child && opening.move !== "*") {
                missingMoves.push({
                    position: item.position,
                    move: opening.move,
                });
            }
        }
    }
    return missingMoves;
}
