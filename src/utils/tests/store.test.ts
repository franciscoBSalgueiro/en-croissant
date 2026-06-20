import { parseUci } from "chessops";
import { beforeEach, expect, test } from "vitest";
import { createTreeStore } from "@/state/store/tree";
import { buildTranspositionMaps, defaultTree, TreeNode, type TreeState } from "@/utils/treeReducer";

const store = createTreeStore();

beforeEach(() => {
    store.setState(defaultTree());
});

const e4 = parseUci("e2e4")!;
const d5 = parseUci("d7d5")!;
const treeE4D5: () => TreeState = () => ({
    ...defaultTree(),
    position: [0, 0],
    root: {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        move: null,
        san: null,
        children: [
            {
                fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                move: e4,
                san: "e4",
                children: [
                    {
                        fen: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
                        move: d5,
                        san: "d5",
                        clock: undefined,
                        children: [],
                        score: null,
                        depth: null,
                        halfMoves: 2,
                        shapes: [],
                        annotations: [],
                        comment: "",
                    },
                ],
                clock: undefined,
                score: null,
                depth: null,
                halfMoves: 1,
                shapes: [],
                annotations: [],
                comment: "",
            },
        ],
        score: null,
        depth: null,
        halfMoves: 0,
        shapes: [],
        annotations: [],
        comment: "",
    },
    report: {
        inProgress: false,
    },
});

const treeE4D5Nf3: () => TreeState = () => ({
    ...defaultTree(),
    position: [0, 0],
    root: {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        move: null,
        san: null,
        children: [
            {
                fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                move: e4,
                san: "e4",
                children: [
                    {
                        fen: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
                        move: d5,
                        san: "d5",
                        clock: undefined,
                        children: [],
                        score: null,
                        depth: null,
                        halfMoves: 2,
                        shapes: [],
                        annotations: [],
                        comment: "",
                    },
                ],
                clock: undefined,
                score: null,
                depth: null,
                halfMoves: 1,
                shapes: [],
                annotations: [],
                comment: "",
            },
            {
                fen: "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1",
                move: parseUci("g1f3")!,
                san: "Nf3",
                children: [],
                clock: undefined,
                score: null,
                depth: null,
                halfMoves: 1,
                shapes: [],
                annotations: [],
                comment: "",
            },
        ],
        score: null,
        depth: null,
        halfMoves: 0,
        shapes: [],
        annotations: [],
        comment: "",
    },
    report: {
        inProgress: false,
    },
});

const getNewState = () => {
    const s = store.getState();
    return {
        root: s.root,
        position: s.position,
        headers: s.headers,
        dirty: s.dirty,
        report: {
            inProgress: false,
        },
        boardStateMap: s.boardStateMap,
    };
};

// Helper to compute the expected boardStateMap for a given root and start path
function expectedMap(root: TreeState["root"], start: number[] = []) {
    return buildTranspositionMaps(root, start);
}

test("should handle save", () => {
    store.setState({ dirty: true });
    store.getState().save();

    expect(getNewState()).toStrictEqual({
        ...defaultTree(),
        dirty: false,
        boardStateMap: expectedMap(defaultTree().root),
    });
});

test("should handle setState", () => {
    const state = treeE4D5();
    store.getState().setState(state);
    expect(getNewState()).toStrictEqual({
        ...state,
        boardStateMap: expectedMap(state.root),
    });
});

test("should handle reset", () => {
    store.setState(treeE4D5());
    store.getState().reset();
    expect(getNewState()).toStrictEqual({
        ...defaultTree(),
        boardStateMap: expectedMap(defaultTree().root),
    });
});

test("should handle setHeaders", () => {
    store.getState().setHeaders({
        ...defaultTree().headers,
        orientation: "black",
        start: [1],
    });

    expect(getNewState()).toStrictEqual({
        ...defaultTree(),
        dirty: true,
        headers: {
            ...defaultTree().headers,
            orientation: "black",
            start: [1],
        },
        boardStateMap: expectedMap(defaultTree().root, [1]),
    });
});

test("should handle setStart", () => {
    store.getState().setStart([1]);

    expect(getNewState()).toStrictEqual({
        ...defaultTree(),
        dirty: true,
        headers: { ...defaultTree().headers, start: [1] },
        boardStateMap: expectedMap(defaultTree().root, [1]),
    });
});

test("should handle makeMove", () => {
    store.getState().makeMove({ payload: e4 });

    expect(getNewState()).toStrictEqual({
        ...defaultTree(),
        dirty: true,
        position: [0],
        root: {
            ...defaultTree().root,
            children: [
                {
                    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                    move: e4,
                    san: "e4",
                    children: [],
                    score: null,
                    clock: undefined,
                    depth: null,
                    halfMoves: 1,
                    shapes: [],
                    annotations: [],
                    comment: "",
                },
            ],
        },
        boardStateMap: expectedMap({
            ...defaultTree().root,
            children: [
                {
                    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                    move: e4,
                    san: "e4",
                    children: [],
                    score: null,
                    clock: undefined,
                    depth: null,
                    halfMoves: 1,
                    shapes: [],
                    annotations: [],
                    comment: "",
                },
            ],
        }),
    });
});

test("should handle makeMoves", () => {
    store.getState().makeMoves({ payload: ["e4", "d5"] });

    const expectedTree = treeE4D5();
    expect(getNewState()).toStrictEqual({
        ...expectedTree,
        dirty: true,
        position: [0, 0],
        boardStateMap: expectedMap(expectedTree.root),
    });
});

test("should handle goToStart", () => {
    store.setState(treeE4D5());
    store.getState().goToStart();

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        position: [],
        boardStateMap: expectedMap(treeE4D5().root),
    });
});

test("should handle goToEnd", () => {
    store.setState({ ...treeE4D5(), position: [] });
    store.getState().goToEnd();

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        position: [0, 0],
        boardStateMap: expectedMap(treeE4D5().root),
    });
});

test("should handle goToNext", () => {
    store.setState({ ...treeE4D5(), position: [] });
    store.getState().goToNext();

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        position: [0],
        boardStateMap: expectedMap(treeE4D5().root),
    });
});

test("should handle goToPrevious", () => {
    store.setState({ ...treeE4D5(), position: [0] });
    store.getState().goToPrevious();

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        position: [],
        boardStateMap: expectedMap(treeE4D5().root),
    });
});

test("should handle goToBranchEnd", () => {
    store.setState({ ...treeE4D5(), position: [] });
    store.getState().goToBranchEnd();

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        position: [0, 0],
        boardStateMap: expectedMap(treeE4D5().root),
    });
});

test("should handle goToBranchStart", () => {
    store.setState({ ...treeE4D5(), position: [0, 0] });
    store.getState().goToBranchStart();

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        position: [],
        boardStateMap: expectedMap(treeE4D5().root),
    });
});

test("should handle goToMove", () => {
    store.setState({ ...treeE4D5(), position: [] });
    store.getState().goToMove([0]);

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        position: [0],
        boardStateMap: expectedMap(treeE4D5().root),
    });
});

test("should handle deleteMove", () => {
    store.setState(treeE4D5());
    store.getState().deleteMove([0]);

    expect(getNewState()).toStrictEqual({
        ...defaultTree(),
        dirty: true,
        boardStateMap: expectedMap(defaultTree().root),
    });
});

test("should handle setAnnotation", () => {
    store.setState({ ...treeE4D5(), position: [0] });
    store.getState().setAnnotation("!");

    const mutatedRoot: TreeNode = {
        ...treeE4D5().root,
        children: [
            {
                ...treeE4D5().root.children[0],
                annotations: ["!"],
            },
        ],
    };

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        dirty: true,
        position: [0],
        root: mutatedRoot,
        boardStateMap: expectedMap(mutatedRoot),
    });
});

test("should handle setComment", () => {
    store.setState({ ...treeE4D5(), position: [0] });
    store.getState().setComment("test");

    const mutatedRoot: TreeNode = {
        ...treeE4D5().root,
        children: [
            {
                ...treeE4D5().root.children[0],
                comment: "test",
            },
        ],
    };

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        dirty: true,
        position: [0],
        root: mutatedRoot,
        boardStateMap: expectedMap(mutatedRoot),
    });
});

test("should handle setFen", () => {
    store.setState({ ...treeE4D5(), position: [0] });
    store.getState().setFen("rnbq1bnr/ppppkppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR w - - 2 3");

    const newRoot = {
        ...defaultTree().root,
        fen: "rnbq1bnr/ppppkppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR w - - 2 3",
    };
    expect(getNewState()).toStrictEqual({
        ...defaultTree(),
        dirty: true,
        root: newRoot,
        boardStateMap: expectedMap(newRoot),
    });
});

test("should handle setScore", () => {
    store.setState({ ...treeE4D5(), position: [0] });
    store.getState().setScore({
        value: { type: "mate" as const, value: 1 },
        wdl: null,
    });

    const mutatedRoot: TreeNode = {
        ...treeE4D5().root,
        children: [
            {
                ...treeE4D5().root.children[0],
                score: {
                    value: { type: "mate" as const, value: 1 },
                    wdl: null,
                },
            },
        ],
    };

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        dirty: true,
        position: [0],
        root: mutatedRoot,
        boardStateMap: expectedMap(mutatedRoot),
    });
});

test("should handle setShapes", () => {
    store.setState({ ...treeE4D5(), position: [0] });
    store.getState().setShapes([{ brush: "red", orig: "e4", dest: "d5" }]);

    const mutatedRoot: TreeNode = {
        ...treeE4D5().root,
        children: [
            {
                ...treeE4D5().root.children[0],
                shapes: [{ brush: "red", orig: "e4", dest: "d5" }],
            },
        ],
    };

    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        dirty: true,
        position: [0],
        root: mutatedRoot,
        boardStateMap: expectedMap(mutatedRoot),
    });
});

test("should handle addAnalysis", () => {
    store.setState({ ...treeE4D5(), position: [0] });
    store.getState().addAnalysis([
        {
            best: [
                {
                    depth: 1,
                    multipv: 1,
                    nodes: 1,
                    score: {
                        value: {
                            type: "cp",
                            value: 10,
                        },
                        wdl: null,
                    },
                    nps: 1000,
                    sanMoves: ["e4"],
                    uciMoves: ["e2e4"],
                },
            ],
            novelty: false,
            is_sacrifice: false,
        },
        {
            best: [
                {
                    depth: 1,
                    multipv: 1,
                    nodes: 1,
                    score: {
                        value: {
                            type: "cp",
                            value: 20,
                        },
                        wdl: null,
                    },
                    nps: 1000,
                    sanMoves: ["d5"],
                    uciMoves: ["d7d5"],
                },
            ],
            novelty: false,
            is_sacrifice: false,
        },
    ]);

    const expectedRoot: TreeNode = {
        ...treeE4D5().root,
        children: [
            {
                ...treeE4D5().root.children[0],
                score: {
                    value: { type: "cp" as const, value: 20 },
                    wdl: null,
                },
            },
        ],
        score: {
            value: { type: "cp" as const, value: 10 },
            wdl: null,
        },
    };
    expect(getNewState()).toStrictEqual({
        ...treeE4D5(),
        dirty: true,
        position: [0],
        root: expectedRoot,
        boardStateMap: expectedMap(expectedRoot),
    });
});
test("should handle promoteVariation", () => {
    store.setState(treeE4D5Nf3());
    store.getState().promoteVariation([1]);

    expect(getNewState()).toStrictEqual({
        ...treeE4D5Nf3(),
        dirty: true,
        position: [0],
        root: {
            ...treeE4D5Nf3().root,
            children: [
                {
                    ...treeE4D5Nf3().root.children[1],
                },
                {
                    ...treeE4D5Nf3().root.children[0],
                },
            ],
        },
        boardStateMap: expectedMap({
            ...treeE4D5Nf3().root,
            children: [
                {
                    ...treeE4D5Nf3().root.children[1],
                },
                {
                    ...treeE4D5Nf3().root.children[0],
                },
            ],
        }),
    });
});

// Helper to build a simple transposition tree:
// 1. e4 e5 2. Nf3 Nc6 (main line with children)
// and a side line 1. Nf3 Nc6 2. e4 e5 transposing to the same position after move 2.
const e4Move = parseUci("e2e4")!;
const e5Move = parseUci("e7e5")!;
const Nf3Move = parseUci("g1f3")!;
const Nc6Move = parseUci("b8c6")!;

const buildTranspositionTree = () => {
    const root: TreeNode = {
        ...defaultTree().root,
        children: [],
    };

    // Main line: e4 e5 Nf3 Nc6
    const e4Node: TreeNode = {
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        move: e4Move,
        san: "e4",
        children: [],
        score: null,
        depth: null,
        halfMoves: 1,
        shapes: [],
        annotations: [],
        comment: "",
    };
    const e5Node: TreeNode = {
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        move: e5Move,
        san: "e5",
        children: [],
        score: null,
        depth: null,
        halfMoves: 2,
        shapes: [],
        annotations: [],
        comment: "",
    };
    const Nf3NodeMain: TreeNode = {
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        move: Nf3Move,
        san: "Nf3",
        children: [],
        score: null,
        depth: null,
        halfMoves: 3,
        shapes: [],
        annotations: [],
        comment: "",
    };
    const Nc6NodeMain: TreeNode = {
        fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        move: Nc6Move,
        san: "Nc6",
        children: [
            {
                fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", // same fen but after playing? Actually need to be a child of Nc6: for simplicity, we'll just give it a child so it has children
                move: parseUci("f1b5")!,
                san: "Bb5",
                children: [],
                score: null,
                depth: null,
                halfMoves: 4,
                shapes: [],
                annotations: [],
                comment: "",
            },
        ],
        score: null,
        depth: null,
        halfMoves: 4,
        shapes: [],
        annotations: [],
        comment: "",
    };

    // Side line: Nf3 Nc6 e4 e5 transposing
    const Nf3NodeSide: TreeNode = {
        fen: "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1",
        move: Nf3Move,
        san: "Nf3",
        children: [],
        score: null,
        depth: null,
        halfMoves: 1,
        shapes: [],
        annotations: [],
        comment: "",
    };
    const Nc6NodeSide: TreeNode = {
        fen: "r1bqkbnr/pppppppp/2n5/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 2 2",
        move: Nc6Move,
        san: "Nc6",
        children: [],
        score: null,
        depth: null,
        halfMoves: 2,
        shapes: [],
        annotations: [],
        comment: "",
    };
    const e4NodeSide: TreeNode = {
        fen: "r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 2", // after e4
        move: e4Move,
        san: "e4",
        children: [],
        score: null,
        depth: null,
        halfMoves: 3,
        shapes: [],
        annotations: [],
        comment: "",
    };
    const e5NodeSide: TreeNode = {
        fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3",
        move: e5Move,
        san: "e5",
        children: [], // this is the transposition node, has no children in side line
        score: null,
        depth: null,
        halfMoves: 4,
        shapes: [],
        annotations: [],
        comment: "",
    };

    // connect main line
    e4Node.children = [e5Node];
    e5Node.children = [Nf3NodeMain];
    Nf3NodeMain.children = [Nc6NodeMain];

    // connect side line
    Nf3NodeSide.children = [Nc6NodeSide];
    Nc6NodeSide.children = [e4NodeSide];
    e4NodeSide.children = [e5NodeSide];

    // root has two branches: e4 (index 0) and Nf3 (index 1)
    root.children = [e4Node, Nf3NodeSide];

    return root;
};

test("goToNext transposition fallback: jump to transposition with children", () => {
    const root = buildTranspositionTree();
    store.getState().setState({
        ...defaultTree(),
        root,
        position: [1, 0, 0, 0], // side line after 1. Nf3 Nc6 e4 e5 (node with no children)
    });

    store.getState().goToNext();

    const state = getNewState();
    // Should have jumped to the main line Nc6 node's first child
    expect(state.position).toEqual([0, 0, 0, 0, 0]); // main line e4 e5 Nf3 Nc6 Bb5
});

test("goToNext transposition fallback: no fallback when no transposition has children", () => {
    // Build a tree where a side line transposes but no node has children
    const rootNoChildren = {
        ...defaultTree().root,
        children: [
            {
                fen: "start",
                move: e4Move,
                san: "e4",
                children: [],
                score: null,
                depth: null,
                halfMoves: 1,
                shapes: [],
                annotations: [],
                comment: "",
            },
            {
                fen: "start",
                move: Nf3Move,
                san: "Nf3",
                children: [],
                score: null,
                depth: null,
                halfMoves: 1,
                shapes: [],
                annotations: [],
                comment: "",
            },
        ],
    };
    store.getState().setState({ ...defaultTree(), root: rootNoChildren, position: [1] });
    const posBefore = store.getState().position;
    store.getState().goToNext();
    expect(store.getState().position).toEqual(posBefore); // no change
});

test("goToNext transposition fallback: lexicographic priority", () => {
    // Shared board state: after 1. e4 e5 2. Nf3
    const sharedFen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";

    // Two nodes that HAVE children and share the same FEN (transposition targets)
    const nodeWithChildA: TreeNode = {
        fen: sharedFen,
        move: Nf3Move,
        san: "Nf3",
        children: [
            {
                // Child gets a distinct but valid FEN
                fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
                move: parseUci("b8c6")!,
                san: "Nc6",
                children: [],
                score: null,
                depth: null,
                halfMoves: 3,
                shapes: [],
                annotations: [],
                comment: "",
            },
        ],
        score: null,
        depth: null,
        halfMoves: 2,
        shapes: [],
        annotations: [],
        comment: "",
    };
    const nodeWithChildB: TreeNode = {
        fen: sharedFen,
        move: Nf3Move,
        san: "Nf3",
        children: [
            {
                fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3", // different move counter makes it distinct but board state identical
                move: parseUci("d2d4")!,
                san: "d4",
                children: [],
                score: null,
                depth: null,
                halfMoves: 3,
                shapes: [],
                annotations: [],
                comment: "",
            },
        ],
        score: null,
        depth: null,
        halfMoves: 2,
        shapes: [],
        annotations: [],
        comment: "",
    };

    // A third node that shares the FEN but has NO children.
    // goToNext from here should trigger transposition fallback.
    const nodeNoChild: TreeNode = {
        fen: sharedFen,
        move: Nf3Move,
        san: "Nf3",
        children: [],
        score: null,
        depth: null,
        halfMoves: 2,
        shapes: [],
        annotations: [],
        comment: "",
    };

    // Build tree:
    // branch 0 -> nodeWithChildA (path [0,0])
    // branch 1 -> nodeWithChildB (path [1,0])
    // branch 2 -> nodeNoChild   (path [2,0])
    const root: TreeNode = {
        ...defaultTree().root,
        children: [
            {
                fen: defaultTree().root.fen,
                move: e4Move,
                san: "e4",
                children: [nodeWithChildA],
                score: null,
                depth: null,
                halfMoves: 1,
                shapes: [],
                annotations: [],
                comment: "",
            },
            {
                fen: defaultTree().root.fen,
                move: Nf3Move,
                san: "Nf3",
                children: [nodeWithChildB],
                score: null,
                depth: null,
                halfMoves: 1,
                shapes: [],
                annotations: [],
                comment: "",
            },
            {
                fen: defaultTree().root.fen,
                move: parseUci("d2d4")!,
                san: "d4",
                children: [nodeNoChild],
                score: null,
                depth: null,
                halfMoves: 1,
                shapes: [],
                annotations: [],
                comment: "",
            },
        ],
    };

    store.getState().setState({ ...defaultTree(), root, position: [2, 0] }); // start at nodeNoChild
    store.getState().goToNext();
    const state = getNewState();
    // Should pick path [0,0] (nodeWithChildA) because it's lexicographically smaller than [1,0]
    expect(state.position).toEqual([0, 0, 0]); // first child of nodeWithChildA
});

test("boardStateMap updates when start changes", () => {
    store.getState().setState(treeE4D5());
    store.getState().setStart([0]); // start at e4 node
    const state = getNewState();
    // The map should now only contain nodes from e4 onward
    const entries = Object.values(state.boardStateMap);
    // There should be at least one entry for the e4 node fen and its child
    expect(entries.length).toBeGreaterThan(0);
    // Make sure the root fen is not in the map (since start excludes it)
    const rootFen = defaultTree().root.fen;
    expect(state.boardStateMap[rootFen]).toBeUndefined();
});

test("practice mode: goToNext transposition fallback bypasses guard", () => {
    const root = buildTranspositionTree();
    store.getState().setState({
        ...defaultTree(),
        root,
        position: [1, 0, 0, 0], // side line, no children
    });
    store.getState().setPracticePath([1, 0, 0, 0]); // end of drill

    store.getState().goToNext();
    const state = getNewState();
    expect(state.position).toEqual([0, 0, 0, 0, 0]); // should jump to transposition child
});
