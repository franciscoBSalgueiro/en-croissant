import { expect, test } from "vitest";
import {
    filterCollapsedRows,
    findRowIndex,
    flattenNotation,
    flattenTableNotation,
} from "../notationFlatten";
import { type TreeNode, treeIterator } from "../treeReducer";

let fenCounter = 0;
function mk(
    san: string | null,
    children: TreeNode[] = [],
    extra: Partial<TreeNode> = {},
): TreeNode {
    fenCounter += 1;
    return {
        fen: `fen-${san ?? "root"}-${fenCounter}`,
        move: null,
        san,
        children,
        score: null,
        depth: null,
        halfMoves: 0,
        shapes: [],
        annotations: [],
        comment: "",
        ...extra,
    };
}

// Build a mainline-only tree: root -> m1 -> m2 -> ... with halfMoves 1,2,3,...
function mainline(sans: string[]): TreeNode {
    let children: TreeNode[] = [];
    for (let i = sans.length - 1; i >= 0; i--) {
        children = [mk(sans[i], children, { halfMoves: i + 1 })];
    }
    return mk(null, children, { halfMoves: 0 });
}

const opts = { showVariations: true, showComments: true };

test("mainline-only tree flattens to a single line row with all move paths in order", () => {
    const root = mainline(["e4", "e5", "Nf3"]);

    const rows = flattenNotation(root, opts);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
        type: "line",
        depth: 0,
        paths: [[0], [0, 0], [0, 0, 0]],
    });
});

test("a sibling variation becomes an indented line; mainline resumes on a new line", () => {
    // root -> e4 -> [e5 (mainline) -> Nf3, c5 (variation)]
    const root = mk(null, [
        mk(
            "e4",
            [
                mk("e5", [mk("Nf3", [], { halfMoves: 3 })], { halfMoves: 2 }),
                mk("c5", [], { halfMoves: 2 }),
            ],
            { halfMoves: 1 },
        ),
    ]);

    const rows = flattenNotation(root, opts);

    expect(rows).toMatchObject([
        { type: "line", depth: 0, paths: [[0], [0, 0]] }, // e4 e5
        { type: "line", depth: 1, paths: [[0, 1]] }, // c5 (variation)
        { type: "line", depth: 0, paths: [[0, 0, 0]] }, // Nf3 (mainline resumes)
    ]);
});

function mainlineWithComment(comment: string) {
    // root -> e4 -> e5(comment) -> Nf3
    return mk(null, [
        mk("e4", [mk("e5", [mk("Nf3", [], { halfMoves: 3 })], { halfMoves: 2, comment })], {
            halfMoves: 1,
        }),
    ]);
}

test("a multiline comment becomes its own comment row and splits the line", () => {
    const root = mainlineWithComment("line one\nline two");

    const rows = flattenNotation(root, opts);

    expect(rows).toMatchObject([
        { type: "line", depth: 0, paths: [[0], [0, 0]] }, // e4 e5
        { type: "comment", depth: 0, path: [0, 0], comment: "line one\nline two" },
        { type: "line", depth: 0, paths: [[0, 0, 0]] }, // Nf3 resumes
    ]);
});

test("a single-line comment does not create a comment row or split the line", () => {
    const root = mainlineWithComment("a short note");

    const rows = flattenNotation(root, opts);

    expect(rows).toMatchObject([{ type: "line", depth: 0, paths: [[0], [0, 0], [0, 0, 0]] }]);
    expect(rows.every((r) => r.type === "line")).toBe(true);
});

test("comments are ignored when showComments is false", () => {
    const root = mainlineWithComment("line one\nline two");

    const rows = flattenNotation(root, { showVariations: true, showComments: false });

    expect(rows).toMatchObject([{ type: "line", depth: 0, paths: [[0], [0, 0], [0, 0, 0]] }]);
});

test("a long unbranched line is capped into continuation rows of maxLineLength moves", () => {
    const root = mainline(["a", "b", "c", "d", "e"]);

    const rows = flattenNotation(root, {
        showVariations: true,
        showComments: true,
        maxLineLength: 2,
    });

    expect(rows).toMatchObject([
        { type: "line", depth: 0, paths: [[0], [0, 0]] }, // a b
        {
            type: "line",
            depth: 0,
            paths: [
                [0, 0, 0],
                [0, 0, 0, 0],
            ],
        }, // c d
        { type: "line", depth: 0, paths: [[0, 0, 0, 0, 0]] }, // e
    ]);
});

test("an empty tree (no moves) produces no rows", () => {
    expect(flattenNotation(mk(null, []), opts)).toEqual([]);
});

test("findRowIndex locates the line row containing a given move path", () => {
    // root -> e4 -> [e5 -> Nf3, c5 -> Nf3b]
    const root = mk(null, [
        mk(
            "e4",
            [
                mk("e5", [mk("Nf3", [], { halfMoves: 3 })], { halfMoves: 2 }),
                mk("c5", [mk("Nf3b", [], { halfMoves: 3 })], { halfMoves: 2 }),
            ],
            { halfMoves: 1 },
        ),
    ]);
    const rows = flattenNotation(root, opts);
    // rows: [line0: e4 e5] [line1: c5 Nf3b] [line0: Nf3]

    expect(findRowIndex(rows, [0])).toBe(0);
    expect(findRowIndex(rows, [0, 0])).toBe(0);
    expect(findRowIndex(rows, [0, 1])).toBe(1);
    expect(findRowIndex(rows, [0, 1, 0])).toBe(1);
    expect(findRowIndex(rows, [0, 0, 0])).toBe(2);
    expect(findRowIndex(rows, [9, 9])).toBe(-1);
});

test("nested variations are indented progressively", () => {
    // root -> e4 -> [e5 -> Nf3, c5 -> [Nc3, e6]]
    const root = mk(null, [
        mk(
            "e4",
            [
                mk("e5", [mk("Nf3", [], { halfMoves: 3 })], { halfMoves: 2 }),
                mk("c5", [mk("Nc3", [], { halfMoves: 3 }), mk("e6", [], { halfMoves: 3 })], {
                    halfMoves: 2,
                }),
            ],
            { halfMoves: 1 },
        ),
    ]);

    const rows = flattenNotation(root, opts);

    expect(rows).toMatchObject([
        { type: "line", depth: 0, paths: [[0], [0, 0]] }, // e4 e5
        {
            type: "line",
            depth: 1,
            paths: [
                [0, 1],
                [0, 1, 0],
            ],
        }, // c5 Nc3
        { type: "line", depth: 2, paths: [[0, 1, 1]] }, // e6 (sub-variation)
        { type: "line", depth: 0, paths: [[0, 0, 0]] }, // Nf3
    ]);
});

test("multiple sibling variations each become their own line at the same depth", () => {
    // root -> e4 -> [e5 -> Nf3, c5, e6]
    const root = mk(null, [
        mk(
            "e4",
            [
                mk("e5", [mk("Nf3", [], { halfMoves: 3 })], { halfMoves: 2 }),
                mk("c5", [], { halfMoves: 2 }),
                mk("e6", [], { halfMoves: 2 }),
            ],
            { halfMoves: 1 },
        ),
    ]);

    const rows = flattenNotation(root, opts);

    expect(rows).toMatchObject([
        { type: "line", depth: 0, paths: [[0], [0, 0]] }, // e4 e5
        { type: "line", depth: 1, paths: [[0, 1]] }, // c5
        { type: "line", depth: 1, paths: [[0, 2]] }, // e6
        { type: "line", depth: 0, paths: [[0, 0, 0]] }, // Nf3
    ]);
});

test("variations are omitted entirely when showVariations is false", () => {
    const root = mk(null, [
        mk(
            "e4",
            [
                mk("e5", [mk("Nf3", [], { halfMoves: 3 })], { halfMoves: 2 }),
                mk("c5", [], { halfMoves: 2 }),
            ],
            { halfMoves: 1 },
        ),
    ]);

    const rows = flattenNotation(root, { showVariations: false, showComments: true });

    expect(rows).toMatchObject([{ type: "line", depth: 0, paths: [[0], [0, 0], [0, 0, 0]] }]);
});

test("every move in the tree appears in exactly one line row (completeness, no duplicates)", () => {
    // deep + branchy tree with comments and a length cap, to exercise all paths
    const root = mk(null, [
        mk(
            "e4",
            [
                mk(
                    "e5",
                    [
                        mk("Nf3", [mk("Nc6", [], { halfMoves: 4 })], {
                            halfMoves: 3,
                            comment: "main\nline",
                        }),
                        mk("Bc4", [], { halfMoves: 3 }),
                    ],
                    { halfMoves: 2 },
                ),
                mk("c5", [mk("Nf3b", [mk("d6", [], { halfMoves: 4 })], { halfMoves: 3 })], {
                    halfMoves: 2,
                }),
            ],
            { halfMoves: 1 },
        ),
    ]);

    const rows = flattenNotation(root, {
        showVariations: true,
        showComments: true,
        maxLineLength: 2,
    });

    const flatPaths = rows
        .flatMap((r) => (r.type === "line" ? r.paths : []))
        .map((p) => p.join(","));
    const allMovePaths: string[] = [];
    for (const { position } of treeIterator(root)) {
        if (position.length > 0) allMovePaths.push(position.join(","));
    }

    expect(new Set(flatPaths).size).toBe(flatPaths.length); // no duplicates
    expect([...flatPaths].sort()).toEqual([...allMovePaths].sort()); // covers every move
});

function chain(prefix: string, len: number): TreeNode {
    let children: TreeNode[] = [];
    for (let i = len - 1; i >= 0; i--) {
        children = [mk(`${prefix}${i}`, children, { halfMoves: i + 1 })];
    }
    return children[0];
}

// A repertoire-sized tree: long mainline, many sibling variations per ply, multi-line comments.
function bigTree(mainLen: number, varsPerNode: number, varLen: number): TreeNode {
    let node = mk(`w${mainLen - 1}`, [], { halfMoves: mainLen });
    for (let i = mainLen - 2; i >= 0; i--) {
        const variations: TreeNode[] = [];
        for (let v = 0; v < varsPerNode; v++) {
            variations.push(chain(`v${i}_${v}_`, varLen));
        }
        node = mk(`w${i}`, [node, ...variations], {
            halfMoves: i + 1,
            comment: i % 5 === 0 ? "multi\nline" : "",
        });
    }
    return mk(null, [node], { halfMoves: 0 });
}

test("flattens a ~6600-node repertoire-sized tree completely with bounded rows", () => {
    const root = bigTree(34, 10, 20); // ~34 + 33*10*20 ≈ 6634 moves

    const allMovePaths: string[] = [];
    for (const { position } of treeIterator(root)) {
        if (position.length > 0) allMovePaths.push(position.join(","));
    }
    expect(allMovePaths.length).toBeGreaterThan(6000);

    const rows = flattenNotation(root, {
        showVariations: true,
        showComments: true,
        maxLineLength: 40,
    });

    const flatPaths = rows
        .flatMap((r) => (r.type === "line" ? r.paths : []))
        .map((p) => p.join(","));
    expect(new Set(flatPaths).size).toBe(flatPaths.length); // no duplicates
    expect([...flatPaths].sort()).toEqual([...allMovePaths].sort()); // covers every move
    for (const r of rows) {
        if (r.type === "line") expect(r.paths.length).toBeLessThanOrEqual(40); // cap respected
    }
});

test("flattenTableNotation pairs mainline moves into white/black rows", () => {
    const root = mainline(["e4", "e5", "Nf3", "Nc6"]); // halfMoves 1,2,3,4

    const rows = flattenTableNotation(root, opts);

    expect(rows).toMatchObject([
        { type: "pair", moveNumber: 1, whitePath: [0], blackPath: [0, 0] },
        { type: "pair", moveNumber: 2, whitePath: [0, 0, 0], blackPath: [0, 0, 0, 0] },
    ]);
});

test("flattenTableNotation leaves blackPath null when white has no reply", () => {
    const root = mainline(["e4", "e5", "Nf3"]); // halfMoves 1,2,3

    const rows = flattenTableNotation(root, opts);

    expect(rows).toMatchObject([
        { type: "pair", moveNumber: 1, whitePath: [0], blackPath: [0, 0] },
        { type: "pair", moveNumber: 2, whitePath: [0, 0, 0], blackPath: null },
    ]);
});

test("flattenTableNotation splits a move with a variation and expands the variation into lines", () => {
    // root -> [e4 -> e5, d4]  (d4 = alternative first move)
    const root = mk(null, [
        mk("e4", [mk("e5", [], { halfMoves: 2 })], { halfMoves: 1 }),
        mk("d4", [], { halfMoves: 1 }),
    ]);

    const rows = flattenTableNotation(root, opts);

    expect(rows).toMatchObject([
        { type: "pair", moveNumber: 1, whitePath: [0], blackPath: null, splitRow: true },
        { type: "line", depth: 1, paths: [[1]] }, // d4 variation rendered as a flowing line
        { type: "pair", moveNumber: 1, whitePath: null, blackPath: [0, 0] }, // e5
    ]);
});

test("flattenTableNotation covers every move (mainline in pairs, variations in lines)", () => {
    const root = bigTree(20, 5, 10);

    const allMovePaths: string[] = [];
    for (const { position } of treeIterator(root)) {
        if (position.length > 0) allMovePaths.push(position.join(","));
    }

    const rows = flattenTableNotation(root, {
        showVariations: true,
        showComments: true,
        maxLineLength: 40,
    });

    const covered = new Set<string>();
    for (const r of rows) {
        if (r.type === "pair") {
            if (r.whitePath) covered.add(r.whitePath.join(","));
            if (r.blackPath) covered.add(r.blackPath.join(","));
        } else if (r.type === "line") {
            for (const p of r.paths) covered.add(p.join(","));
        }
    }

    expect([...covered].sort()).toEqual([...allMovePaths].sort());
});

test("findRowIndex locates a mainline move inside a table pair row", () => {
    const root = mainline(["e4", "e5", "Nf3"]);
    const rows = flattenTableNotation(root, opts);
    // pair0: white [0], black [0,0]; pair1: white [0,0,0]

    expect(findRowIndex(rows, [0])).toBe(0);
    expect(findRowIndex(rows, [0, 0])).toBe(0);
    expect(findRowIndex(rows, [0, 0, 0])).toBe(1);
    expect(findRowIndex(rows, [5])).toBe(-1);
});

test("line rows carry first:true for variation/mainline starts and false for mainline resumes", () => {
    // root -> e4 -> [e5 -> Nf3, c5]
    const root = mk(null, [
        mk(
            "e4",
            [
                mk("e5", [mk("Nf3", [], { halfMoves: 3 })], { halfMoves: 2 }),
                mk("c5", [], { halfMoves: 2 }),
            ],
            { halfMoves: 1 },
        ),
    ]);

    const rows = flattenNotation(root, opts);

    expect(rows).toMatchObject([
        { type: "line", paths: [[0], [0, 0]], first: true }, // e4 e5 (start)
        { type: "line", paths: [[0, 1]], first: true }, // c5 (variation start)
        { type: "line", paths: [[0, 0, 0]], first: false }, // Nf3 (mainline resumes)
    ]);
});

test("the first line of a variation group carries branchHead = the branch point path", () => {
    // root -> e4 -> [e5 -> Nf3, c5]  (branch at [0]; first variation c5 at [0,1])
    const root = mk(null, [
        mk(
            "e4",
            [
                mk("e5", [mk("Nf3", [], { halfMoves: 3 })], { halfMoves: 2 }),
                mk("c5", [], { halfMoves: 2 }),
            ],
            { halfMoves: 1 },
        ),
    ]);

    const rows = flattenNotation(root, opts);
    const variationLine = rows.find((r) => r.type === "line" && r.paths[0].join(",") === "0,1");
    const mainLine = rows.find((r) => r.type === "line" && r.paths[0].join(",") === "0");

    expect(variationLine).toMatchObject({ branchHead: [0] });
    expect((mainLine as { branchHead?: number[] }).branchHead).toBeUndefined();
});

test("filterCollapsedRows hides nested variation rows but keeps the branch head and the mainline", () => {
    // root -> e4 -> [e5 -> Nf3, c5 -> [Nc3, e6]]
    const root = mk(null, [
        mk(
            "e4",
            [
                mk("e5", [mk("Nf3", [], { halfMoves: 3 })], { halfMoves: 2 }),
                mk("c5", [mk("Nc3", [], { halfMoves: 3 }), mk("e6", [], { halfMoves: 3 })], {
                    halfMoves: 2,
                }),
            ],
            { halfMoves: 1 },
        ),
    ]);

    const rows = flattenNotation(root, opts);
    const visible = filterCollapsedRows(rows, new Set(["0"])); // collapse the branch at [0]
    const lineKeys = visible
        .filter((r) => r.type === "line")
        .map((r) => (r.type === "line" ? r.paths[0].join(",") : ""));

    expect(lineKeys).toContain("0"); // mainline e4 e5
    expect(lineKeys).toContain("0,1"); // head (c5 Nc3) kept, rendered collapsed
    expect(lineKeys).toContain("0,0,0"); // mainline Nf3 resumes
    expect(lineKeys).not.toContain("0,1,1"); // e6 sub-variation hidden
});

test("filterCollapsedRows with an empty set returns the rows unchanged", () => {
    const root = mk(null, [
        mk(
            "e4",
            [mk("e5", [], { halfMoves: 2 }), mk("c5", [], { halfMoves: 2 })],
            { halfMoves: 1 },
        ),
    ]);
    const rows = flattenNotation(root, opts);

    expect(filterCollapsedRows(rows, new Set())).toEqual(rows);
});
