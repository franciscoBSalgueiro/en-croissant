import { Chess, DEFAULT_POSITION, Move, Square } from "chess.js";
import { DrawShape } from "chessground/draw";
import { Annotation, MoveAnalysis, Score, getAnnotation } from "./chess";
import { Outcome } from "./db";
import { isPrefix } from "./misc";

export interface TreeNode {
    fen: string;
    move: Move | null;
    children: TreeNode[];
    score: Score | null;
    depth: number | null;
    halfMoves: number;
    shapes: DrawShape[];
    annotation: Annotation;
    commentHTML: string;
    commentText: string;
}

export function defaultTree(fen?: string): TreeState {
    return {
        position: [],
        root: {
            fen: fen ?? DEFAULT_POSITION,
            move: null,
            children: [],
            score: null,
            depth: null,
            halfMoves: 0,
            shapes: [],
            annotation: Annotation.None,
            commentHTML: "",
            commentText: "",
        },
        headers: {
            id: 0,
            black: {
                id: 0,
                name: "",
            },
            white: {
                id: 0,
                name: "",
            },
            ply_count: 0,
            result: Outcome.Unknown,
            event: {
                id: 0,
                name: "",
            },
            site: {
                id: 0,
                name: "",
            },
        },
    };
}

export function createNode({
    fen,
    move,
    halfMoves,
}: {
    move: Move;
    fen: string;
    halfMoves: number;
}): TreeNode {
    return {
        fen,
        move,
        children: [],
        score: null,
        depth: null,
        halfMoves,
        shapes: [],
        annotation: Annotation.None,
        commentHTML: "",
        commentText: "",
    };
}

export type GameHeaders = {
    id: number;
    event: {
        id: number;
        name: string;
    };
    site: {
        id: number;
        name: string;
    };
    date?: string;
    time?: string;
    round?: string;
    white: {
        id: number;
        name: string;
        elo?: number;
    };
    white_elo?: number | null;
    black: {
        id: number;
        name: string;
        elo?: number;
    };
    black_elo?: number | null;
    result: Outcome;
    time_control?: string;
    eco?: string;
    ply_count: number;
    white_material?: number;
    black_material?: number;
};

export function headersToPGN(game: GameHeaders): string {
    let headers = `[Event "${game.event.name || "?"}"]
[Site "${game.site.name || "?"}"]
[Date "${game.date || "????.??.??"}"]
[Round "${game.round || "?"}"]
[White "${game.white.name || "?"}"]
[Black "${game.black.name || "?"}"]
[Result "${game.result}"]
`;
    return headers;
}

export type TreeAction =
    | { type: "SET_HEADERS"; payload: GameHeaders }
    | {
          type: "MAKE_MOVE";
          payload:
              | {
                    from: Square;
                    to: Square;
                    promotion?: string;
                }
              | string;
      }
    | { type: "MAKE_MOVES"; payload: string[] }
    | { type: "GO_TO_START" }
    | { type: "GO_TO_END" }
    | { type: "GO_TO_NEXT" }
    | { type: "GO_TO_PREVIOUS" }
    | { type: "GO_TO_MOVE"; payload: number[] }
    | { type: "DELETE_MOVE"; payload?: number[] }
    | { type: "SET_ANNOTATION"; payload: Annotation }
    | { type: "SET_COMMENT"; payload: { html: string; text: string } }
    | { type: "SET_FEN"; payload: string }
    | { type: "SET_SCORE"; payload: Score }
    | { type: "SET_OUTCOME"; payload: Outcome }
    | { type: "SET_SHAPES"; payload: DrawShape[] }
    | { type: "ADD_ANALYSIS"; payload: MoveAnalysis[] }
    | { type: "PROMOTE_VARIATION"; payload: number[] };

export interface TreeState {
    root: TreeNode;
    headers: GameHeaders;
    position: number[];
}

function deepCopy<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

const treeReducer = (state: TreeState, action: TreeAction): TreeState => {
    switch (action.type) {
        case "SET_HEADERS":
            return { ...state, headers: action.payload };
        case "MAKE_MOVE":
            return makeMove(state, action.payload);
        case "MAKE_MOVES":
            for (const move of action.payload) {
                state = makeMove(state, move);
            }
            return state;
        case "GO_TO_START":
            return { ...state, position: [] };
        case "GO_TO_END":
            const endPosition: number[] = [];
            let currentNode = state.root;
            while (currentNode.children.length > 0) {
                endPosition.push(0);
                currentNode = currentNode.children[0];
            }
            return { ...state, position: endPosition };
        case "GO_TO_NEXT":
            const nextPosition = [...state.position];
            const nextNode = getNodeAtPath(state.root, nextPosition);
            if (!nextNode) return state;
            if (nextNode.children.length === 0) return state;
            nextPosition.push(0);
            return { ...state, position: nextPosition };
        case "GO_TO_PREVIOUS":
            const previousPosition = [...state.position];
            if (previousPosition.length === 0) return state;
            previousPosition.pop();
            return { ...state, position: previousPosition };
        case "GO_TO_MOVE":
            return { ...state, position: action.payload };
        case "DELETE_MOVE":
            return deleteMove(state, action.payload || state.position);
        case "SET_ANNOTATION":
            return setAnnotation(state, action.payload);
        case "SET_COMMENT":
            return setComment(state, action.payload);
        case "SET_FEN":
            return setFen(state, action.payload);
        case "SET_SCORE":
            return setScore(state, action.payload);
        case "ADD_ANALYSIS":
            return addAnalysis(state, action.payload);
        case "SET_SHAPES":
            return setShapes(state, action.payload);
        case "PROMOTE_VARIATION":
            return promoteVariation(state, action.payload);
        default:
            return state;
    }
};

function makeMove(
    state: TreeState,
    move: { from: Square; to: Square; promotion?: string } | string
) {
    const newTree = deepCopy(state.root);
    const newPosition = [...state.position];
    const moveNode = getNodeAtPath(newTree, state.position);
    if (!moveNode) return state;
    const chess = new Chess(moveNode.fen);
    let m: Move;
    try {
        m = chess.move(move);
    } catch (e) {
        return state;
    }
    const i = moveNode.children.findIndex((n) => n.move?.san === m.san);
    if (i !== -1) {
        newPosition.push(i);
        return { ...state, root: newTree, position: newPosition };
    }
    const newMoveNode = createNode({
        fen: chess.fen(),
        move: m,
        halfMoves: moveNode.halfMoves + 1,
    });
    moveNode.children.push(newMoveNode);
    newPosition.push(moveNode.children.length - 1);
    return { ...state, root: newTree, position: newPosition };
}

function deleteMove(state: TreeState, path: number[]) {
    const newTree = deepCopy(state.root);
    const node = getNodeAtPath(newTree, path);
    if (!node) return state;
    const parent = getNodeAtPath(newTree, path.slice(0, -1));
    if (!parent) return state;
    const index = parent.children.findIndex((n) => n === node);
    parent.children.splice(index, 1);
    if (isPrefix(path, state.position)) {
        return { ...state, root: newTree, position: path.slice(0, -1) };
    }
    return { ...state, root: newTree };
}

function setAnnotation(state: TreeState, annotation: Annotation) {
    const newTree = deepCopy(state.root);
    const node = getNodeAtPath(newTree, state.position);
    if (!node) return state;
    if (node.annotation === annotation) {
        node.annotation = Annotation.None;
    } else {
        node.annotation = annotation;
    }
    return { ...state, root: newTree };
}

function setComment(state: TreeState, payload: { html: string; text: string }) {
    const newTree = deepCopy(state.root);
    const node = getNodeAtPath(newTree, state.position);
    if (!node) return state;
    node.commentHTML = payload.html;
    node.commentText = payload.text;
    return { ...state, root: newTree };
}

function setScore(state: TreeState, score: Score): TreeState {
    const newTree = deepCopy(state.root);
    const node = getNodeAtPath(newTree, state.position);
    if (!node) return state;
    node.score = score;
    return { ...state, root: newTree };
}

function setFen(state: TreeState, fen: string): TreeState {
    const newTree = defaultTree(fen);
    return { ...state, root: newTree.root, position: [] };
}

function promoteVariation(state: TreeState, path: number[]): TreeState {
    const newTree = deepCopy(state.root);
    // get last element different from 0
    const [v, i] = path.reduceRight(
        (acc, v, i) => (v === 0 ? acc : [v, i]),
        [0, 0]
    );
    if (i === 0) return state;
    const promotablePath = path.slice(0, i);
    const newPosition = [...path];
    newPosition[i] = 0;
    if (promotablePath.length === 0) return state;
    const node = getNodeAtPath(newTree, promotablePath);
    if (!node) return state;
    node.children.unshift(node.children.splice(v, 1)[0]);
    return { ...state, root: newTree, position: newPosition };
}

export const getNodeAtPath = (
    node: TreeNode,
    path: number[]
): TreeNode | null => {
    if (path.length === 0) return node;
    const index = path[0];
    if (index >= node.children.length) return null;
    return getNodeAtPath(node.children[index], path.slice(1));
};

function addAnalysis(state: TreeState, analysis: MoveAnalysis[]): TreeState {
    let newTree = deepCopy(state.root);
    let cur = newTree.children[0];
    let i = 0;
    while (cur !== undefined) {
        console.log(analysis[i]);
        cur.score = analysis[i].best.score;
        if (analysis[i].novelty) {
            cur.commentHTML = "Novelty";
            cur.commentText = "Novelty";
        }
        let prevScore: Score = { type: "cp", value: 0 };
        if (i > 0) {
            prevScore = analysis[i - 1].best.score;
        }
        const curScore = analysis[i].best.score;
        const isWhite = i % 2 === 0;
        cur.annotation = getAnnotation(prevScore, curScore, isWhite);
        cur = cur.children[0];
        i++;
    }
    return { ...state, root: newTree };
}

function setShapes(state: TreeState, shapes: DrawShape[]): TreeState {
    console.log(shapes);
    const newTree = deepCopy(state.root);
    const node = getNodeAtPath(newTree, state.position);
    if (!node) return state;
    const shape = shapes[0];
    const index = node.shapes.findIndex(
        (s) => s.orig === shape.orig && s.dest === shape.dest
    );

    if (index !== -1) {
        node.shapes.splice(index, 1);
    } else {
        node.shapes.push(shape);
    }
    return { ...state, root: newTree };
}

export default treeReducer;
