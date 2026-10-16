import { parseSan } from "chessops/san";
import { makeFen } from "chessops/fen";
import { expect, test } from "vitest";
import { buildFromTree, continueInBranch, getAnswers } from "@/components/files/opening";
import { positionFromFen } from "../chessops";
import { createNode, defaultTree, getNodeAtPath, type TreeNode } from "../treeReducer";

// Adds `san` as the next variation from `node` and returns the new node
function addMove(node: TreeNode, san: string): TreeNode {
    const [pos] = positionFromFen(node.fen);
    const move = parseSan(pos!, san)!;
    pos!.play(move);
    const child = createNode({
        fen: makeFen(pos!.toSetup()),
        move,
        san,
        halfMoves: node.halfMoves + 1,
    });
    node.children.push(child);
    return child;
}

// Adds a line of moves as a new variation from `node` and returns its last node
function addLine(node: TreeNode, sans: string[]): TreeNode {
    return sans.reduce(addMove, node);
}

test("every repertoire reply to a move is a correct answer, not just the first variation", () => {
    // A Black repertoire answering 1.e4 with 1...e5, 1...c5 and 1...e6
    const root = defaultTree().root;
    const afterE4 = addMove(root, "e4");
    addMove(afterE4, "e5");
    addMove(afterE4, "c5");
    addMove(afterE4, "e6");

    const answers = getAnswers(root, [0]).map((answer) => answer.san);

    expect(answers).toEqual(["e5", "c5", "e6"]);
    expect(answers).not.toContain("d5");
});

test("branch points deeper in a line accept each repertoire move", () => {
    // Italian Game: both 3...Bc5 and 3...Nf6 are in the repertoire after 3.Bc4
    const root = defaultTree().root;
    const afterBc4 = addLine(root, ["e4", "e5", "Nf3", "Nc6", "Bc4"]);
    addMove(afterBc4, "Bc5");
    addMove(afterBc4, "Nf6");

    expect(getAnswers(root, [0, 0, 0, 0, 0]).map((answer) => answer.san)).toEqual(["Bc5", "Nf6"]);
});

test("a position accepts the repertoire's moves however it was reached (transpositions)", () => {
    const root = defaultTree().root;
    // 1.d4 Nf6 2.c4 e6 3.Nc3, answered with 3...Bb4
    const viaD4 = addLine(root, ["d4", "Nf6", "c4", "e6", "Nc3"]);
    addMove(viaD4, "Bb4");
    // 1.c4 Nf6 2.Nc3 e6 3.d4 reaches the same position, answered with 3...d5 or 3...Bb4
    const viaC4 = addLine(root, ["c4", "Nf6", "Nc3", "e6", "d4"]);
    addMove(viaC4, "d5");
    addMove(viaC4, "Bb4");

    // Same position, but the FENs differ in the halfmove clock (3.Nc3 vs the pawn move 3.d4)
    expect(viaD4.fen).not.toBe(viaC4.fen);

    const answers = getAnswers(root, [0, 0, 0, 0, 0]);
    expect(answers.map((answer) => answer.san)).toEqual(["Bb4", "d5"]);
    // Bb4 stays on the current line; d5 leads to the existing node in the other line,
    // so playing it doesn't add a move to the repertoire
    expect(answers[0].path).toEqual([0, 0, 0, 0, 0, 0]);
    expect(getNodeAtPath(root, answers[1].path)).toBe(viaC4.children[0]);
});

test("full practice continues down the branch of the move just played", () => {
    // Black repertoire: 1.e4 e5 2.Nf3 Nc6 and 1.e4 c5 2.Nf3 d6
    const root = defaultTree().root;
    const afterE4 = addMove(root, "e4");
    const e5 = addMove(afterE4, "e5");
    addLine(e5, ["Nf3", "Nc6"]);
    const c5 = addMove(afterE4, "c5");
    addLine(c5, ["Nf3", "d6"]);

    // Tree order: after 1.e4, after 1.e4 e5 2.Nf3, after 1.e4 c5 2.Nf3
    const positions = buildFromTree(root, "black", []);
    expect(positions.map((p) => p.answer)).toEqual(["e5", "Nc6", "d6"]);

    // Answering 1.e4 with the second variation goes on with the c5 line, not back to e5
    expect(continueInBranch([1, 2], positions, c5)).toEqual([2, 1]);
    // Answering with the first variation keeps the order
    expect(continueInBranch([1, 2], positions, e5)).toEqual([1, 2]);
    // Once the c5 line is done, the rest of the queue carries on as before
    expect(continueInBranch([1], positions, c5)).toEqual([1]);
});
