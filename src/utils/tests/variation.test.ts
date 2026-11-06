import { expect, test } from "vitest";
import type { Annotation } from "../annotation";
import { getVariationLine } from "../chess";
import { defaultTree, type TreeNode } from "../treeReducer";

function moveNode(annotations: Annotation[] = []): TreeNode {
    return {
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        move: { from: 12, to: 28 },
        san: "e4",
        children: [],
        score: null,
        depth: null,
        halfMoves: 1,
        shapes: [],
        annotations,
        comment: "",
    };
}

test("variation line stops at the last existing move", () => {
    const root = defaultTree().root;
    root.children = [moveNode()];

    expect(() => getVariationLine(root, [0, 3])).not.toThrow();
    expect(getVariationLine(root, [0, 3])).toEqual(["e2e4"]);
});
