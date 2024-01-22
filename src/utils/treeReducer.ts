import { Chess, Move, Square } from "chess.js";
import { DrawShape } from "chessground/draw";
import { Annotation } from "./chess";
import { Outcome } from "./db";
import { isPrefix } from "./misc";
import { getAnnotation } from "./score";
import { match } from "ts-pattern";
import { BestMoves, Score } from "@/bindings";
import { INITIAL_FEN, parseFen } from "chessops/fen";

export interface TreeState {
  root: TreeNode;
  headers: GameHeaders;
  position: number[];
  dirty: boolean;
}

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
  clock?: number;
}

export type ListNode = {
  position: number[];
  node: TreeNode;
};

export function* treeIterator(node: TreeNode): Generator<ListNode> {
  const stack: ListNode[] = [{ position: [], node }];
  while (stack.length > 0) {
    const { position, node } = stack.pop()!;
    yield { position, node };
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push({ position: [...position, i], node: node.children[i] });
    }
  }
}

export function* treeIteratorMainLine(node: TreeNode): Generator<ListNode> {
  let current: ListNode | undefined = { position: [], node };
  while (current?.node) {
    yield current;
    current = {
      position: [...current.position, 0],
      node: current.node.children[0],
    };
  }
}

export function countMainPly(node: TreeNode): number {
  let count = 0;
  let cur = node;
  while (cur.children.length > 0) {
    count++;
    cur = cur.children[0];
  }
  return count;
}

export function defaultTree(fen?: string): TreeState {
  return {
    dirty: false,
    position: [],
    root: {
      fen: fen?.trim() ?? INITIAL_FEN,
      move: null,
      children: [],
      score: null,
      depth: null,
      halfMoves: 0,
      shapes: [],
      annotation: "",
      commentHTML: "",
      commentText: "",
    },
    headers: {
      id: 0,
      fen: fen ?? INITIAL_FEN,
      black: "",
      white: "",
      result: "*",
      event: "",
      site: "",
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
    annotation: "",
    commentHTML: "",
    commentText: "",
  };
}

export type GameHeaders = {
  id: number;
  fen: string;
  event: string;
  site: string;
  date?: string;
  time?: string;
  round?: string;
  white: string;
  white_elo?: number | null;
  black: string;
  black_elo?: number | null;
  result: Outcome;
  time_control?: string;
  eco?: string;
  white_material?: number;
  black_material?: number;
  // Repertoire headers
  start?: number[];
  orientation?: "white" | "black";
};

export function headersToPGN(game: GameHeaders): string {
  let headers = `[Event "${game.event || "?"}"]
[Site "${game.site || "?"}"]
[Date "${game.date || "????.??.??"}"]
[Round "${game.round || "?"}"]
[White "${game.white || "?"}"]
[Black "${game.black || "?"}"]
[Result "${game.result}"]
`;
  if (game.white_elo) {
    headers += `[WhiteElo "${game.white_elo}"]\n`;
  }
  if (game.black_elo) {
    headers += `[BlackElo "${game.black_elo}"]\n`;
  }
  if (game.start && game.start.length > 0) {
    headers += `[Start "${JSON.stringify(game.start)}"]\n`;
  }
  if (game.orientation) {
    headers += `[Orientation "${game.orientation}"]\n`;
  }
  if (game.time_control) {
    headers += `[TimeControl "${game.time_control}"]\n`;
  }
  if (game.eco) {
    headers += `[ECO "${game.eco}"]\n`;
  }
  return headers;
}

export function getGameName(headers: GameHeaders) {
  if (
    (headers.white && headers.white !== "?") ||
    (headers.black && headers.black !== "?")
  ) {
    return `${headers.white} - ${headers.black}`;
  }
  if (headers.event) {
    return headers.event;
  }
  return "Unknown";
}

export type TreeAction =
  | { type: "SAVE" }
  | { type: "SET_STATE"; payload: TreeState }
  | { type: "RESET" }
  | { type: "SET_HEADERS"; payload: GameHeaders }
  | { type: "SET_ORIENTATION"; payload: "white" | "black" }
  | { type: "SET_START"; payload: number[] }
  | {
      type: "MAKE_MOVE";
      payload:
        | {
            from: Square;
            to: Square;
            promotion?: string;
          }
        | string;
      changePosition?: boolean;
      mainline?: boolean;
    }
  | {
      type: "APPEND_MOVE";
      payload:
        | {
            from: Square;
            to: Square;
            promotion?: string;
          }
        | string;
    }
  | { type: "MAKE_MOVES"; payload: string[]; mainline?: boolean }
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
  | { type: "SET_SHAPES"; payload: DrawShape[] }
  | { type: "CLEAR_SHAPES" }
  | {
      type: "ADD_ANALYSIS";
      payload: {
        best: BestMoves[];
        novelty: boolean;
        is_sacrifice: boolean;
      }[];
    }
  | { type: "PROMOTE_VARIATION"; payload: number[] }
  | { type: "PROMOTE_TO_MAINLINE"; payload: number[] };

const treeReducer = (state: TreeState, action: TreeAction) => {
  const res = match(action)
    .with({ type: "SET_STATE" }, ({ payload }) => {
      return payload;
    })
    .with({ type: "SAVE" }, () => {
      state.dirty = false;
    })
    .with({ type: "RESET" }, () => {
      return defaultTree();
    })
    .with({ type: "SET_HEADERS" }, ({ payload }) => {
      state.dirty = true;
      state.headers = payload;
    })
    .with({ type: "SET_ORIENTATION" }, ({ payload }) => {
      state.dirty = true;
      state.headers.orientation = payload;
    })
    .with({ type: "SET_START" }, ({ payload }) => {
      state.dirty = true;
      state.headers.start = payload;
    })
    .with({ type: "MAKE_MOVE" }, ({ payload, changePosition, mainline }) => {
      makeMove({ state, move: payload, last: false, changePosition, mainline });
    })
    .with({ type: "APPEND_MOVE" }, ({ payload }) => {
      makeMove({ state, move: payload, last: true });
    })
    .with({ type: "MAKE_MOVES" }, ({ payload, mainline }) => {
      state.dirty = true;
      for (const move of payload) {
        makeMove({ state, move, last: false, mainline });
      }
    })
    .with({ type: "GO_TO_START" }, () => {
      state.position = state.headers.start || [];
    })
    .with({ type: "GO_TO_END" }, () => {
      const endPosition: number[] = [];
      let currentNode = state.root;
      while (currentNode.children.length > 0) {
        endPosition.push(0);
        currentNode = currentNode.children[0];
      }
      state.position = endPosition;
    })
    .with({ type: "GO_TO_NEXT" }, () => {
      const node = getNodeAtPath(state.root, state.position);
      if (node && node.children.length > 0) {
        state.position.push(0);
      }
    })
    .with({ type: "GO_TO_PREVIOUS" }, () => {
      if (state.position.length !== 0) {
        state.position.pop();
      }
    })
    .with({ type: "GO_TO_MOVE" }, ({ payload }) => {
      state.position = payload;
    })
    .with({ type: "DELETE_MOVE" }, (action) => {
      state.dirty = true;
      deleteMove(state, action.payload || state.position);
    })
    .with({ type: "SET_ANNOTATION" }, ({ payload }) => {
      state.dirty = true;
      const node = getNodeAtPath(state.root, state.position);
      if (node) {
        if (node.annotation === payload) {
          node.annotation = "";
        } else {
          node.annotation = payload;
        }
      }
    })
    .with({ type: "SET_COMMENT" }, ({ payload }) => {
      state.dirty = true;
      const node = getNodeAtPath(state.root, state.position);
      if (node) {
        node.commentHTML = payload.html;
        node.commentText = payload.text;
      }
    })
    .with({ type: "SET_FEN" }, ({ payload }) => {
      state.dirty = true;
      state.root = defaultTree(payload).root;
      state.position = [];
    })
    .with({ type: "SET_SCORE" }, ({ payload }) => {
      state.dirty = true;
      const node = getNodeAtPath(state.root, state.position);
      if (node) {
        node.score = payload;
      }
    })
    .with({ type: "ADD_ANALYSIS" }, ({ payload }) => {
      state.dirty = true;
      addAnalysis(state, payload);
    })
    .with({ type: "SET_SHAPES" }, ({ payload }) => {
      state.dirty = true;
      setShapes(state, payload);
    })
    .with({ type: "CLEAR_SHAPES" }, () => {
      state.dirty = true;
      const node = getNodeAtPath(state.root, state.position);
      if (node) {
        node.shapes = [];
      }
    })
    .with({ type: "PROMOTE_VARIATION" }, ({ payload }) => {
      state.dirty = true;
      promoteVariation(state, payload);
    })
    .with({ type: "PROMOTE_TO_MAINLINE" }, ({ payload }) => {
      state.dirty = true;
      while (!promoteVariation(state, payload)) {}
    })
    .exhaustive();

  return res;
};

function isThreeFoldRepetition(state: TreeState, fen: string) {
  let node = state.root;
  const fens = [INITIAL_FEN.split(" - ")[0]];
  for (const i of state.position) {
    node = node.children[i];
    fens.push(node.fen.split(" - ")[0]);
  }
  return fens.filter((f) => f === fen.split(" - ")[0]).length >= 2;
}

function is50MoveRule(state: TreeState) {
  let node = state.root;
  let count = 0;
  for (const i of state.position) {
    count += 1;
    if (
      node.move?.captured ||
      node.move?.promotion ||
      node.move?.piece === "p"
    ) {
      count = 0;
    }
    node = node.children[i];
  }
  return count >= 100;
}

function makeMove({
  state,
  move,
  last,
  changePosition = true,
  mainline = false,
}: {
  state: TreeState;
  move: { from: Square; to: Square; promotion?: string } | string;
  last: boolean;
  changePosition?: boolean;
  mainline?: boolean;
}) {
  const mainLine = Array.from(treeIteratorMainLine(state.root));
  const position = last
    ? mainLine[mainLine.length - 1].position
    : state.position;
  const moveNode = getNodeAtPath(state.root, position);
  if (!moveNode) return;
  const chess = new Chess(moveNode.fen);
  let m: Move;
  try {
    m = chess.move(move);
  } catch (e) {
    return;
  }
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      state.headers.result = chess.turn() === "w" ? "0-1" : "1-0";
    }
    if (chess.isDraw()) {
      state.headers.result = "1/2-1/2";
    }
  }

  if (isThreeFoldRepetition(state, chess.fen()) || is50MoveRule(state)) {
    state.headers.result = "1/2-1/2";
  }

  const i = moveNode.children.findIndex((n) => n.move?.san === m.san);
  if (i !== -1) {
    if (changePosition) {
      if (state.position === position) {
        state.position.push(i);
      } else {
        state.position = [...position, i];
      }
    }
  } else {
    state.dirty = true;
    const newMoveNode = createNode({
      fen: chess.fen(),
      move: m,
      halfMoves: moveNode.halfMoves + 1,
    });
    if (mainline) {
      moveNode.children.unshift(newMoveNode);
    } else {
      moveNode.children.push(newMoveNode);
    }
    if (changePosition) {
      if (state.position === position) {
        if (mainline) {
          state.position.push(0);
        } else {
          state.position.push(moveNode.children.length - 1);
        }
      } else {
        state.position = [...position, moveNode.children.length - 1];
      }
    }
  }
}

function deleteMove(state: TreeState, path: number[]) {
  const node = getNodeAtPath(state.root, path);
  if (!node) return;
  const parent = getNodeAtPath(state.root, path.slice(0, -1));
  if (!parent) return;
  const index = parent.children.findIndex((n) => n === node);
  parent.children.splice(index, 1);
  if (isPrefix(path, state.position)) {
    state.position = path.slice(0, -1);
  } else if (isPrefix(path.slice(0, -1), state.position)) {
    if (state.position.length === path.length) {
      state.position[state.position.length - 1] = 0;
    }
  }
}

function promoteVariation(state: TreeState, path: number[]) {
  // get last element different from 0
  const i = path.findLastIndex((v) => v !== 0);
  if (i === -1) return state;

  const v = path[i];
  const promotablePath = path.slice(0, i);
  const node = getNodeAtPath(state.root, promotablePath);
  if (!node) return state;
  node.children.unshift(node.children.splice(v, 1)[0]);
  state.position = path;
  state.position[i] = 0;
}

export const getNodeAtPath = (node: TreeNode, path: number[]): TreeNode => {
  if (path.length === 0) return node;
  const index = path[0];
  // if (index >= node.children.length) throw new Error("Invalid path");
  // Just return the root in case of invalid path as handling this is annoying
  if (index >= node.children.length) return node;
  return getNodeAtPath(node.children[index], path.slice(1));
};

function addAnalysis(
  state: TreeState,
  analysis: {
    best: BestMoves[];
    novelty: boolean;
    is_sacrifice: boolean;
  }[],
) {
  let cur = state.root;
  let i = 0;
  const setup = parseFen(state.root.fen).unwrap();
  const initialColor = setup.turn;
  while (cur !== undefined && i < analysis.length) {
    if (!new Chess(cur.fen).isGameOver()) {
      cur.score = analysis[i].best[0].score;
      if (analysis[i].novelty) {
        cur.commentHTML = "Novelty";
        cur.commentText = "Novelty";
      }
      let prevScore = null;
      let prevprevScore = null;
      let prevMoves: BestMoves[] = [];
      if (i > 0) {
        prevScore = analysis[i - 1].best[0].score;
        prevMoves = analysis[i - 1].best;
      }
      if (i > 1) {
        prevprevScore = analysis[i - 2].best[0].score;
      }
      const curScore = analysis[i].best[0].score;
      const color =
        i % 2 === (initialColor === "white" ? 1 : 0) ? "white" : "black";
      cur.annotation = getAnnotation(
        prevprevScore,
        prevScore,
        curScore,
        color,
        prevMoves,
        analysis[i].is_sacrifice,
        cur.move?.san ?? "",
      );
    }
    cur = cur.children[0];
    i++;
  }
}

function setShapes(state: TreeState, shapes: DrawShape[]) {
  const node = getNodeAtPath(state.root, state.position);
  if (!node) return state;
  const shape = shapes[0];
  const index = node.shapes.findIndex(
    (s) => s.orig === shape.orig && s.dest === shape.dest,
  );

  if (index !== -1) {
    node.shapes.splice(index, 1);
  } else {
    node.shapes.push(shape);
  }
}

export default treeReducer;
