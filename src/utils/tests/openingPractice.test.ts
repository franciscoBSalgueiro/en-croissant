import { Chess } from "chessops/chess";
import { makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { describe, expect, it } from "vitest";
import { buildFromTree } from "@/components/files/opening";
import { defaultTree, type TreeNode } from "../treeReducer";

function lineTree(moves: string[]) {
    const root = defaultTree().root;
    let node = root;
    const position = Chess.default();
    for (const san of moves) {
        const move = parseSan(position, san)!;
        position.play(move);
        const child: TreeNode = {
            ...defaultTree().root,
            san,
            move,
            fen: makeFen(position.toSetup()),
            halfMoves: node.halfMoves + 1,
        };
        node.children.push(child);
        node = child;
    }
    return root;
}

describe("opening repertoire practice", () => {
    it("includes the initial white move, even for a one-move catalog line", () => {
        const positions = buildFromTree(lineTree(["Nh3"]), "white", []);
        expect(positions).toHaveLength(1);
        expect(positions[0].answer).toBe("Nh3");
    });
    it("trains only the selected side's responses", () => {
        const root = lineTree(["e4", "e5", "Nf3", "Nc6", "Bc4"]);
        expect(buildFromTree(root, "white", []).map((card) => card.answer)).toEqual([
            "e4",
            "Nf3",
            "Bc4",
        ]);
        expect(buildFromTree(root, "black", []).map((card) => card.answer)).toEqual(["e5", "Nc6"]);
    });
    it("includes the chosen starting position and excludes earlier positions", () => {
        const cards = buildFromTree(lineTree(["e4", "e5", "Nf3", "Nc6", "Bc4"]), "white", [0, 0]);
        expect(cards.map((card) => card.answer)).toEqual(["Nf3", "Bc4"]);
    });
});
