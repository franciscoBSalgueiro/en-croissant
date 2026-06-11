import { getNodeAtPath, type TreeNode } from "./treeReducer";

export type NotationLineRow = {
    type: "line";
    key: string;
    depth: number;
    // Whether this line's first move should always show its move number (matches the old
    // renderer: true for the first move of a variation and the very first mainline move; false
    // for a mainline that resumes after a variation, where a black move shows no number).
    first: boolean;
    paths: number[][];
};

export type NotationCommentRow = {
    type: "comment";
    key: string;
    depth: number;
    path: number[];
    comment: string;
};

export type NotationRow = NotationLineRow | NotationCommentRow;

// Table view: one mainline move pair (white | black). A missing side is null (rendered empty).
export type NotationPairRow = {
    type: "pair";
    key: string;
    moveNumber: number;
    whitePath: number[] | null;
    blackPath: number[] | null;
    splitRow?: boolean;
};

// Table view rows: mainline pairs, plus the same comment/flowing-line rows used for variations.
export type TableNotationRow = NotationPairRow | NotationLineRow | NotationCommentRow;

export type FlattenOptions = {
    showVariations: boolean;
    showComments: boolean;
    maxLineLength?: number;
};

// Mirrors the multi-line detection in Comment.tsx: a comment that renders as a block (and
// therefore breaks the inline flow) gets its own row; a single-line comment stays inline.
export function isMultilineComment(comment: string): boolean {
    return comment.split("\n").filter((line) => line.trim() !== "").length > 1;
}

// Index of the row containing `path` (the move tree position), for scroll-to-current-move.
// Handles both flowing line rows and table pair rows. Returns -1 when the path is not present
// (e.g. variations hidden, or the position is the root).
export function findRowIndex(rows: TableNotationRow[], path: number[]): number {
    const key = path.join(",");
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.type === "line" && row.paths.some((p) => p.join(",") === key)) {
            return i;
        }
        if (row.type === "pair") {
            if (row.whitePath?.join(",") === key || row.blackPath?.join(",") === key) {
                return i;
            }
        }
    }
    return -1;
}

// Walk the mainline from `startPath` (following children[0]) accumulating moves into a single
// flowing line, appending line/comment rows to `rows`. Mirrors RenderVariationTree: at a node,
// children[0] is the next mainline move and children[1..] are sibling variations. A branch
// flushes the current line, emits each variation as an indented sub-line, then resumes the
// mainline on a fresh line. The mainline is walked iteratively (no stack growth on long lines);
// recursion depth is bounded by variation nesting only. Shared by both the flowing view
// (flattenNotation) and the variation blocks of the table view (flattenTableNotation).
function emitLines(
    root: TreeNode,
    opts: FlattenOptions,
    rows: TableNotationRow[],
    startPath: number[],
    depth: number,
    initialLine: number[][],
) {
    // The first non-empty line in this walk is the variation/mainline start (its first move
    // always shows a number); later lines are continuations after a sub-variation.
    let isFirstLine = true;
    const flushLine = (paths: number[][]) => {
        if (paths.length === 0) return;
        rows.push({
            type: "line",
            key: `line:${paths[0].join(",")}`,
            depth,
            first: isFirstLine,
            paths,
        });
        isFirstLine = false;
    };
    let path = startPath;
    let line = initialLine;
    for (;;) {
        const node = getNodeAtPath(root, path);
        if (node.children.length === 0) break;
        const mainPath = [...path, 0];
        const moveNode = node.children[0];
        line.push(mainPath);
        if (opts.showComments && moveNode.comment && isMultilineComment(moveNode.comment)) {
            flushLine(line);
            rows.push({
                type: "comment",
                key: `comment:${mainPath.join(",")}`,
                depth,
                path: mainPath,
                comment: moveNode.comment,
            });
            line = [];
        }
        if (opts.showVariations && node.children.length > 1) {
            flushLine(line);
            for (let i = 1; i < node.children.length; i++) {
                emitLines(root, opts, rows, [...path, i], depth + 1, [[...path, i]]);
            }
            line = [];
        }
        if (opts.maxLineLength && line.length >= opts.maxLineLength) {
            flushLine(line);
            line = [];
        }
        path = mainPath;
    }
    flushLine(line);
}

export function flattenNotation(root: TreeNode, opts: FlattenOptions): NotationRow[] {
    const rows: NotationRow[] = [];
    emitLines(root, opts, rows, [], 0, []);
    return rows;
}

// Table view. Ports the proven mainline-pairing walk from the old TableNotation segment builder,
// but emits a flat, windowable row list: mainline moves as `pair` rows (white | black grid),
// mainline comments as `comment` rows, and each variation block expanded into flowing line rows
// (via emitLines, depth 1+) instead of one un-windowed nested subtree.
export function flattenTableNotation(root: TreeNode, opts: FlattenOptions): TableNotationRow[] {
    const rows: TableNotationRow[] = [];
    const { showVariations, showComments } = opts;

    const pushPair = (
        moveNumber: number,
        whitePath: number[] | null,
        blackPath: number[] | null,
        splitRow?: boolean,
    ) => {
        const keyPath = whitePath ?? blackPath ?? [];
        rows.push({
            type: "pair",
            key: `pair:${keyPath.join(",")}`,
            moveNumber,
            whitePath,
            blackPath,
            splitRow,
        });
    };
    const pushComment = (path: number[], comment: string) => {
        rows.push({ type: "comment", key: `comment:${path.join(",")}`, depth: 0, path, comment });
    };
    const pushVariations = (parentPath: number[], variations: TreeNode[]) => {
        for (let vIdx = 0; vIdx < variations.length; vIdx++) {
            const variationPath = [...parentPath, vIdx + 1];
            emitLines(root, opts, rows, variationPath, 1, [variationPath]);
        }
    };

    let current = root;
    let path: number[] = [];

    while (current.children.length > 0) {
        const child = current.children[0];
        const childPath = [...path, 0];
        const isWhite = child.halfMoves % 2 === 1;
        const moveNum = Math.ceil(child.halfMoves / 2);
        const whiteVariations = current.children.slice(1);

        if (isWhite) {
            const hasWhiteVars = showVariations && whiteVariations.length > 0;
            const hasWhiteComment = showComments && !!child.comment;

            let blackNode: TreeNode | null = null;
            let blackPath: number[] = [];
            let blackVariations: TreeNode[] = [];

            if (child.children.length > 0) {
                const blackChild = child.children[0];
                const bPath = [...childPath, 0];
                if (blackChild.halfMoves % 2 === 0) {
                    blackNode = blackChild;
                    blackPath = bPath;
                    blackVariations = child.children.slice(1);
                }
            }

            const hasBlackVars = showVariations && blackVariations.length > 0;
            const hasBlackComment = showComments && !!blackNode?.comment;
            const splitWhite = hasWhiteVars || hasWhiteComment;

            if (splitWhite) {
                pushPair(moveNum, childPath, null, !!blackNode);
                if (hasWhiteComment) pushComment(childPath, child.comment);
                if (hasWhiteVars) pushVariations(childPath.slice(0, -1), whiteVariations);

                if (blackNode) {
                    pushPair(moveNum, null, blackPath);
                    if (hasBlackComment) pushComment(blackPath, blackNode.comment);
                    if (hasBlackVars) pushVariations(blackPath.slice(0, -1), blackVariations);
                    current = blackNode;
                    path = blackPath;
                } else {
                    current = child;
                    path = childPath;
                }
            } else if (hasBlackVars || hasBlackComment) {
                pushPair(moveNum, childPath, blackPath);
                if (hasBlackComment) pushComment(blackPath, blackNode!.comment);
                if (hasBlackVars) pushVariations(blackPath.slice(0, -1), blackVariations);
                current = blackNode!;
                path = blackPath;
            } else {
                pushPair(moveNum, childPath, blackNode ? blackPath : null);
                if (blackNode) {
                    current = blackNode;
                    path = blackPath;
                } else {
                    current = child;
                    path = childPath;
                }
            }
        } else {
            const hasBlackVars = showVariations && whiteVariations.length > 0;
            const hasBlackComment = showComments && !!child.comment;
            pushPair(moveNum, null, childPath);
            if (hasBlackComment) pushComment(childPath, child.comment);
            if (hasBlackVars) pushVariations(childPath.slice(0, -1), whiteVariations);
            current = child;
            path = childPath;
        }
    }

    return rows;
}
