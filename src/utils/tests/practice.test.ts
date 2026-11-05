import { parseSan } from "chessops/san";
import { makeFen } from "chessops/fen";
import { createEmptyCard } from "ts-fsrs";
import { expect, test } from "vitest";
import {
    buildFromTree,
    cardForMove,
    countMoves,
    getAnswers,
    getLineProgress,
    getStats,
    isAnswerDone,
    moveKey,
    type Position,
    type PracticeStep,
    planNextQuestion,
    positionKey,
    positionsWithCards,
    syncDeck,
    updateCardPerformance,
} from "@/components/files/opening";
import type { PracticeData } from "@/state/atoms";
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

// Black repertoire: 1...c5 2.Nf3 Nc6, then 3.d4 cxd4 4.Nxd4 g6 or 3.Nc3 g6; and 1...e5 2.Nf3
// Nc6 3.Bc4, then 3...Bc5 4.c3 or 3...Nf6 4.Ng5, then 4...d5 5.exd5 Na5 6.Bd3 / 5...Nxd5,
// or 4...Rb8
function blackRepertoire() {
    const root = defaultTree().root;
    const afterE4 = addMove(root, "e4");
    const afterNc6 = addLine(afterE4, ["c5", "Nf3", "Nc6"]);
    addLine(afterNc6, ["d4", "cxd4", "Nxd4", "g6"]);
    addLine(afterNc6, ["Nc3", "g6"]);
    const afterBc4 = addLine(afterE4, ["e5", "Nf3", "Nc6", "Bc4"]);
    addLine(afterBc4, ["Bc5", "c3"]);
    const afterNg5 = addLine(afterBc4, ["Nf6", "Ng5"]);
    const afterExd5 = addLine(afterNg5, ["d5", "exd5"]);
    addLine(afterExd5, ["Na5", "Bd3"]);
    addMove(afterExd5, "Nxd5");
    addMove(afterNg5, "Rb8");
    return root;
}

// The positions with a practice card, as in the app
function askableIn(root: TreeNode, color: "white" | "black" = "black") {
    return positionsWithCards(buildFromTree(root, color, []));
}

function pathTo(root: TreeNode, line: string) {
    const path: number[] = [];
    let node = root;
    for (const san of line.split(" ")) {
        const i = node.children.findIndex((child) => child.san === san);
        path.push(i);
        node = node.children[i];
    }
    return path;
}

function lineAt(root: TreeNode, path: number[]) {
    return path.map((_, i) => getNodeAtPath(root, path.slice(0, i + 1)).san).join(" ");
}

// Every one of the user's moves along these lines, as practiced
function practicedAlong(root: TreeNode, askable: Set<string>, ...lines: string[]) {
    const practiced = new Set<string>();
    for (const line of lines) {
        let node = root;
        for (const san of line.split(" ")) {
            if (askable.has(positionKey(node.fen))) practiced.add(moveKey(node.fen, san));
            node = node.children.find((child) => child.san === san)!;
        }
    }
    return practiced;
}

function readable(root: TreeNode, plan: { steps: PracticeStep[]; ask: number[] | null }) {
    return {
        steps: plan.steps.map((step) => (step.jump ? "back to " : "") + lineAt(root, step.path)),
        ask: plan.ask && lineAt(root, plan.ask),
    };
}

const SICILIAN_D4 = "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6";
const SICILIAN_NC3 = "e4 c5 Nf3 Nc6 Nc3 g6";
const BC5 = "e4 e5 Nf3 Nc6 Bc4 Bc5";
const NA5 = "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5";
const NXD5 = "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5";
const RB8 = "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Rb8";

test("full practice starts by playing the opponent's first move", () => {
    const root = blackRepertoire();

    expect(readable(root, planNextQuestion(root, [], new Set(), askableIn(root), false))).toEqual({
        steps: ["e4"],
        ask: "e4",
    });
});

test("after your move, the opponent's reply is played and your next position asked", () => {
    const root = blackRepertoire();
    const askable = askableIn(root);
    const practiced = practicedAlong(root, askable, "e4 c5");

    expect(
        readable(root, planNextQuestion(root, pathTo(root, "e4 c5"), practiced, askable, true)),
    ).toEqual({ steps: ["e4 c5 Nf3"], ask: "e4 c5 Nf3" });
});

test("at the end of a line, the opponent's last reply is shown, then it's back to your branch point for your other move", () => {
    const root = blackRepertoire();
    const askable = askableIn(root);
    const practiced = practicedAlong(root, askable, NA5);

    // Not on to 5...Nxd5 6.Nxf7 with your 5...Nxd5 already played: back to 5.exd5 to play it
    expect(
        readable(root, planNextQuestion(root, pathTo(root, NA5), practiced, askable, true)),
    ).toEqual({
        steps: [`${NA5} Bd3`, "back to e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5"],
        ask: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5",
    });
});

test("after a line, it goes back to the opponent's branch point and plays their other move", () => {
    const root = blackRepertoire();
    const askable = askableIn(root);
    const practiced = practicedAlong(root, askable, SICILIAN_D4);

    expect(
        readable(root, planNextQuestion(root, pathTo(root, SICILIAN_D4), practiced, askable, true)),
    ).toEqual({ steps: ["back to e4 c5 Nf3 Nc6", "e4 c5 Nf3 Nc6 Nc3"], ask: "e4 c5 Nf3 Nc6 Nc3" });
});

test("moves you've practiced are asked again on the way to what's left, never played for you", () => {
    const root = blackRepertoire();
    const askable = askableIn(root);
    // Everything but 4...Rb8
    const practiced = practicedAlong(root, askable, SICILIAN_D4, SICILIAN_NC3, BC5, NA5, NXD5);

    expect(
        readable(
            root,
            planNextQuestion(root, pathTo(root, SICILIAN_NC3), practiced, askable, true),
        ),
    ).toEqual({ steps: ["back to e4"], ask: "e4" });
    // Then you play 1...e5 again, and it carries on towards 4...Rb8
    expect(
        readable(root, planNextQuestion(root, pathTo(root, "e4 e5"), practiced, askable, true)),
    ).toEqual({ steps: ["e4 e5 Nf3"], ask: "e4 e5 Nf3" });
});

test("full practice ends once every move has been practiced", () => {
    const root = blackRepertoire();
    const askable = askableIn(root);
    const practiced = practicedAlong(root, askable, SICILIAN_D4, SICILIAN_NC3, BC5, NA5, NXD5, RB8);

    expect(planNextQuestion(root, pathTo(root, RB8), practiced, askable, true).ask).toBeNull();
});

test("a full session asks every one of your moves and never plays one for you", () => {
    const root = blackRepertoire();
    const askable = askableIn(root);
    const practiced = new Set<string>();
    let plan = planNextQuestion(root, [], practiced, askable, false);
    let questions = 0;
    while (plan.ask && questions < 100) {
        for (const step of plan.steps.filter((step) => !step.jump)) {
            expect(askable.has(positionKey(getNodeAtPath(root, step.path.slice(0, -1)).fen))).toBe(
                false,
            );
        }
        // Answer with a move that still adds something, as the user would
        const ask = plan.ask;
        const node = getNodeAtPath(root, ask);
        const i = node.children.findIndex(
            (child, i) =>
                !isAnswerDone(
                    root,
                    node.fen,
                    { san: child.san!, path: [...ask, i] },
                    practiced,
                    askable,
                ),
        );
        practiced.add(moveKey(node.fen, node.children[i].san!));
        plan = planNextQuestion(root, [...ask, i], practiced, askable, true);
        questions++;
    }

    expect(plan.ask).toBeNull();
    expect(practiced.size).toBe(13);
    expect(countMoves(root, askable)).toBe(13);
});

test("a move counts as already practiced only when nothing is left after it", () => {
    const root = blackRepertoire();
    const askable = askableIn(root);
    const practiced = practicedAlong(root, askable, NA5);
    const EXD5 = "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5";
    const fen = getNodeAtPath(root, pathTo(root, EXD5)).fen;
    const atExd5 = (san: string) =>
        isAnswerDone(root, fen, { san, path: pathTo(root, `${EXD5} ${san}`) }, practiced, askable);

    expect(atExd5("Na5")).toBe(true);
    expect(atExd5("Nxd5")).toBe(false);
    // 1...e5 was practiced, but there's more to practice after it
    const e4 = getNodeAtPath(root, pathTo(root, "e4"));
    expect(
        isAnswerDone(root, e4.fen, { san: "e5", path: pathTo(root, "e4 e5") }, practiced, askable),
    ).toBe(false);
});

test("a move reachable by transposition is one move to practice", () => {
    const root = defaultTree().root;
    // 1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 and 1.c4 Nf6 2.Nc3 e6 3.d4 d5 / 3...Bb4 reach the same position
    addLine(root, ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]);
    const viaC4 = addLine(root, ["c4", "Nf6", "Nc3", "e6", "d4"]);
    addMove(viaC4, "d5");
    addMove(viaC4, "Bb4");
    const askable = askableIn(root);

    // Nf6 and e6 in each move order, then 3...Bb4 once and 3...d5
    expect(countMoves(root, askable)).toBe(6);
    // Having played 3...Bb4 after 3.Nc3, it's already practiced after 3.d4 too
    const practiced = practicedAlong(root, askable, "d4 Nf6 c4 e6 Nc3 Bb4");
    const bb4 = { san: "Bb4", path: pathTo(root, "c4 Nf6 Nc3 e6 d4 Bb4") };
    expect(isAnswerDone(root, viaC4.fen, bb4, practiced, askable)).toBe(true);
});

// Black repertoire: 1.e4 e5 2.Nf3 Nc6 3.Bc4, answered with 3...Bc5 (4.c3 Nf6) or 3...Nf6,
// after which White plays 4.Ng5 (4...d5) or 4.d3 (4...Be7)
function italian() {
    const root = defaultTree().root;
    const afterBc4 = addLine(root, ["e4", "e5", "Nf3", "Nc6", "Bc4"]);
    addLine(afterBc4, ["Bc5", "c3", "Nf6"]);
    const afterNf6 = addMove(afterBc4, "Nf6");
    addLine(afterNf6, ["Ng5", "d5"]);
    addLine(afterNf6, ["d3", "Be7"]);
    return root;
}
const BC4 = [0, 0, 0, 0, 0];

test("line counter: hidden until the repertoire first splits", () => {
    const visited = [[0], [0, 0], [0, 0, 0]];

    expect(getLineProgress(italian(), [0, 0, 0], visited, "black", [])).toBeNull();
});

test("line counter: at your own branch point, M is the number of your options", () => {
    const visited = [[0], [0, 0], [0, 0, 0], [0, 0, 0, 0], BC4];

    expect(getLineProgress(italian(), BC4, visited, "black", [])).toEqual({ current: 1, total: 2 });
});

test("line counter: uses the most recent split and counts lines in the order you take them", () => {
    const root = italian();
    // Choosing 3...Nf6 (the second variation) first, then White's 4.Ng5
    const visited = [[0], [0, 0], [0, 0, 0], [0, 0, 0, 0], BC4, [...BC4, 1], [...BC4, 1, 0]];
    expect(getLineProgress(root, [...BC4, 1, 0], visited, "black", [])).toEqual({
        current: 1,
        total: 2,
    });

    // Then 4.d3, the other line from the same split
    visited.push([...BC4, 1, 0, 0], [...BC4, 1, 1]);
    expect(getLineProgress(root, [...BC4, 1, 1], visited, "black", [])).toEqual({
        current: 2,
        total: 2,
    });

    // Back at the 3.Bc4 split: 3...Bc5 is the second line taken, though it's the first variation
    visited.push([...BC4, 1, 1, 0], [...BC4, 0, 0]);
    expect(getLineProgress(root, [...BC4, 0, 0], visited, "black", [])).toEqual({
        current: 2,
        total: 2,
    });
});

test("line counter: a line that ends with your move still counts", () => {
    // 1.e4 answered with 1...e5 (2.Nf3 Nc6) or 1...c5, with nothing after 1...c5
    const root = defaultTree().root;
    const afterE4 = addMove(root, "e4");
    addLine(afterE4, ["e5", "Nf3", "Nc6"]);
    addMove(afterE4, "c5");

    expect(getLineProgress(root, [0], [[0]], "black", [])).toEqual({ current: 1, total: 2 });
    // After playing 1...c5 first, the e5 line is the second one
    expect(getLineProgress(root, [0, 0, 0], [[0], [0, 1], [0, 0, 0]], "black", [])).toEqual({
        current: 2,
        total: 2,
    });
});

test("line counter: an opponent move with nothing for you to play after it isn't a line", () => {
    // White's 2.Bc4 is in the repertoire, but Black has no reply to it
    const root = defaultTree().root;
    const afterE5 = addLine(root, ["e4", "e5"]);
    addLine(afterE5, ["Nf3", "Nc6"]);
    addMove(afterE5, "Bc4");

    expect(getLineProgress(root, [0, 0, 0], [[0], [0, 0, 0]], "black", [])).toBeNull();
});

test("line counter: splits before the Start position don't count", () => {
    // White repertoire: 1.e4 e5 2.Nf3 Nc6 3.Bc4 and 1.d4 d5 2.c4
    const root = defaultTree().root;
    addLine(root, ["e4", "e5", "Nf3", "Nc6", "Bc4"]);
    addLine(root, ["d4", "d5", "c4"]);

    expect(getLineProgress(root, [0, 0], [[0, 0]], "white", [])).toEqual({ current: 1, total: 2 });
    // With the Start position set after 1.e4 e5, the 1.e4 / 1.d4 choice is before it
    expect(getLineProgress(root, [0, 0], [[0, 0]], "white", [0, 0])).toBeNull();
});

test("every one of your moves gets its own spaced-repetition card", () => {
    const root = blackRepertoire();
    const cards = buildFromTree(root, "black", []);
    const afterE4 = getNodeAtPath(root, pathTo(root, "e4")).fen;
    const afterNg5 = getNodeAtPath(root, pathTo(root, "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5")).fen;

    // Both replies to 1.e4, and 4...Rb8 next to 4...d5, not just the first move
    expect(cards.filter((c) => c.fen === afterE4).map((c) => c.answer)).toEqual(["c5", "e5"]);
    expect(cards.filter((c) => c.fen === afterNg5).map((c) => c.answer)).toEqual(["d5", "Rb8"]);
    // The counts are per move: 13 moves across 9 positions
    expect(getStats(cards).unseen).toBe(13);
    expect(new Set(cards.map((c) => c.fen)).size).toBe(9);
});

test("syncing a deck keeps each move's progress and gives your other moves new cards", () => {
    const root = blackRepertoire();
    const afterE4 = getNodeAtPath(root, pathTo(root, "e4")).fen;
    // A deck from before, with one card per position: 1...c5 has been reviewed
    const reviewed = { ...createEmptyCard(new Date(Date.now() + 86_400_000)), reps: 3 };
    const existing: Position[] = [
        { fen: afterE4, answer: "c5", card: reviewed },
        { fen: afterE4, answer: "d5", card: createEmptyCard() }, // no longer in the repertoire
    ];

    const { positions, added, removed } = syncDeck(existing, root, "black", []);

    expect(positions.find((c) => c.fen === afterE4 && c.answer === "c5")?.card).toBe(reviewed);
    expect(positions.find((c) => c.fen === afterE4 && c.answer === "e5")?.card.reps).toBe(0);
    expect(positions).toHaveLength(13);
    expect(added).toBe(12);
    expect(removed).toBe(1);
});

test("a correct move counts for its own card when that card is due, otherwise it's already practiced", () => {
    const root = blackRepertoire();
    const afterE4 = getNodeAtPath(root, pathTo(root, "e4")).fen;
    const due = createEmptyCard(new Date(Date.now() - 60_000));
    const notDue = { ...createEmptyCard(new Date(Date.now() + 86_400_000)), reps: 2 };
    const cards = (e5: typeof due): Position[] => [
        { fen: afterE4, answer: "c5", card: due },
        { fen: afterE4, answer: "e5", card: e5 },
    ];

    // Asked for 1...c5
    expect(cardForMove(cards(due), 0, "c5")).toBe(0);
    // 1...e5 is also correct: its own card is rated if it's due...
    expect(cardForMove(cards(due), 0, "e5")).toBe(1);
    // ...and if it isn't, it was already practiced
    expect(cardForMove(cards(notDue), 0, "e5")).toBeNull();
});

test("a correct move counts for its card at a transposition of the same position", () => {
    const root = defaultTree().root;
    const viaD4 = addLine(root, ["d4", "Nf6", "c4", "e6", "Nc3"]);
    addMove(viaD4, "Bb4");
    const viaC4 = addLine(root, ["c4", "Nf6", "Nc3", "e6", "d4"]);
    addMove(viaC4, "d5");
    const due = createEmptyCard(new Date(Date.now() - 60_000));
    const cards: Position[] = [
        { fen: viaC4.fen, answer: "d5", card: due },
        { fen: viaD4.fen, answer: "Bb4", card: due },
    ];

    // Asked for 3...d5 after 3.d4; 3...Bb4 (from 1.d4's move order) is rated on its own card
    expect(cardForMove(cards, 0, "Bb4")).toBe(1);
});

test("rating a card adds its log as a new list, with the move, so the logs view updates", () => {
    const data: PracticeData = {
        positions: buildFromTree(blackRepertoire(), "black", []),
        logs: [],
    };
    let next = data;
    updateCardPerformance(
        (update) => {
            next = typeof update === "function" ? update(data) : update;
        },
        1,
        data.positions[1].card,
        3,
    );

    // A new list: the memoized logs view only re-renders when the list itself changes
    expect(next.logs).not.toBe(data.logs);
    expect(next.logs).toEqual([
        expect.objectContaining({
            rating: 3,
            fen: data.positions[1].fen,
            answer: data.positions[1].answer,
        }),
    ]);
    // The rated card itself is updated in place: Start Practice picks the next card right away
    expect(data.positions[1].card.reps).toBe(1);
});

test("a move reachable by two move orders is one card, the same as in full practice", () => {
    const root = defaultTree().root;
    // 1.d4 Nf6 2.c4 e6 3.Nc3 and 1.c4 Nf6 2.Nc3 e6 3.d4 reach the same position (only the
    // halfmove clock differs); 3...Bb4 is in the repertoire both ways
    addLine(root, ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]);
    const viaC4 = addLine(root, ["c4", "Nf6", "Nc3", "e6", "d4"]);
    addMove(viaC4, "d5");
    addMove(viaC4, "Bb4");
    const cards = buildFromTree(root, "black", []);

    expect(cards.filter((c) => c.answer === "Bb4")).toHaveLength(1);
    // Start Practice and Practice Full Repertoire count the same moves
    expect(cards).toHaveLength(countMoves(root, positionsWithCards(cards)));
    expect(cards).toHaveLength(6);
});

test("syncing an older deck merges its two cards for a transposed move, keeping the more practiced", () => {
    const root = defaultTree().root;
    const viaD4 = addLine(root, ["d4", "Nf6", "c4", "e6", "Nc3"]);
    addMove(viaD4, "Bb4");
    const viaC4 = addLine(root, ["c4", "Nf6", "Nc3", "e6", "d4"]);
    addMove(viaC4, "Bb4");
    const practiced = { ...createEmptyCard(new Date(Date.now() + 86_400_000)), reps: 4 };
    // From before cards ignored the move counters: one 3...Bb4 card for each move order
    // (the practiced one first, so keeping simply the last one would lose its progress)
    const existing: Position[] = [
        { fen: viaC4.fen, answer: "Bb4", card: practiced },
        { fen: viaD4.fen, answer: "Bb4", card: createEmptyCard() },
    ];

    const { positions, removed } = syncDeck(existing, root, "black", []);
    const bb4 = positions.filter((c) => c.answer === "Bb4");

    expect(bb4).toHaveLength(1);
    expect(bb4[0].card).toBe(practiced);
    expect(removed).toBe(1);
});
