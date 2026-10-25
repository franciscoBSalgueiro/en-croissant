import { expect, test } from "vitest";
import { type Annotation } from "../annotation";
import { getMoveText } from "../chess";
import type { TreeNode } from "../treeReducer";

function moveNode(annotations: Annotation[]): TreeNode {
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

test("PGN glyphs are written as symbols, not as the annotation array", () => {
    const moveText = getMoveText(moveNode(["!"]), {
        glyphs: true,
        comments: false,
        extraMarkups: false,
    });

    expect(moveText).toBe("1. e4! ");
});

test("a move with several annotations keeps one glyph and one NAG", () => {
    const moveText = getMoveText(moveNode(["!", "±"]), {
        glyphs: true,
        comments: false,
        extraMarkups: false,
    });

    expect(moveText).toBe("1. e4! $16 ");
});
