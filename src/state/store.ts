import type { BestMoves, Outcome, Score } from "@/bindings";
import { ANNOTATION_INFO, type Annotation } from "@/utils/annotation";
import { getPGN } from "@/utils/chess";
import { parseSanOrUci, positionFromFen } from "@/utils/chessops";
import { isPrefix } from "@/utils/misc";
import { getAnnotation } from "@/utils/score";
import { playSound } from "@/utils/sound";
import {
  type GameHeaders,
  type TreeNode,
  type TreeState,
  createNode,
  defaultTree,
  getNodeAtPath,
  treeIteratorMainLine,
} from "@/utils/treeReducer";
import type { DrawShape } from "chessground/draw";
import { type Move, isNormal } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { makeSan, parseSan } from "chessops/san";
import { produce } from "immer";
import { type StateCreator, createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface TreeStoreState {
  root: TreeNode;
  headers: GameHeaders;
  position: number[];
  dirty: boolean;

  currentNode: () => TreeNode;

  goToNext: () => void;
  goToPrevious: () => void;
  goToStart: () => void;
  goToEnd: () => void;
  goToMove: (move: number[]) => void;
  goToBranchStart: () => void;
  goToBranchEnd: () => void;
  nextBranch: () => void;
  previousBranch: () => void;
  nextBranching: () => void;
  previousBranching: () => void;

  goToAnnotation: (annotation: Annotation, color: "white" | "black") => void;

  makeMove: (args: {
    payload: string | Move;
    changePosition?: boolean;
    mainline?: boolean;
    clock?: number;
    changeHeaders?: boolean;
  }) => void;

  appendMove: (args: {
    payload: Move;
    clock?: number;
  }) => void;

  makeMoves: (args: {
    payload: string[];
    mainline?: boolean;
    changeHeaders?: boolean;
  }) => void;
  deleteMove: (path?: number[]) => void;
  promoteVariation: (path: number[]) => void;
  promoteToMainline: (path: number[]) => void;
  copyVariationPgn: (path: number[]) => void;

  setStart: (start: number[]) => void;

  setAnnotation: (payload: Annotation) => void;
  setComment: (payload: string) => void;
  setHeaders: (payload: GameHeaders) => void;
  setResult: (payload: Outcome) => void;
  setShapes: (shapes: DrawShape[]) => void;
  setScore: (score: Score) => void;

  clearShapes: () => void;

  setFen: (fen: string) => void;

  addAnalysis: (
    analysis: {
      best: BestMoves[];
      novelty: boolean;
      is_sacrifice: boolean;
    }[],
  ) => void;

  setState: (state: TreeState) => void;
  reset: () => void;
  save: () => void;
}

export type TreeStore = ReturnType<typeof createTreeStore>;

export const createTreeStore = (id?: string, initialTree?: TreeState) => {
  const stateCreator: StateCreator<TreeStoreState> = (set, get) => ({
    ...(initialTree ?? defaultTree()),

    currentNode: () => getNodeAtPath(get().root, get().position),

    setState: (state) => {
      set(() => state);
    },

    reset: () =>
      set(() => {
        return defaultTree();
      }),

    save: () => {
      set((state) => ({
        ...state,
        dirty: false,
      }));
    },

    setFen: (fen) =>
      set(
        produce((state) => {
          state.dirty = true;
          state.root = defaultTree(fen).root;
          state.position = [];
        }),
      ),

    goToNext: () =>
      set((state) => {
        const node = getNodeAtPath(state.root, state.position);
        const [pos] = positionFromFen(node.fen);
        if (!pos || !node.children[0]?.move) return state;
        const san = makeSan(pos, node.children[0].move);
        playSound(san.includes("x"), san.includes("+"));
        if (node && node.children.length > 0) {
          return {
            ...state,
            position: [...state.position, 0],
          };
        }
        return state;
      }),
    goToPrevious: () =>
      set((state) => ({ ...state, position: state.position.slice(0, -1) })),

    goToAnnotation: (annotation, color) =>
      set(
        produce((state) => {
          const colorN = color === "white" ? 1 : 0;

          let p: number[] = state.position;
          let node = getNodeAtPath(state.root, p);
          while (true) {
            if (node.children.length === 0) {
              p = [];
            } else {
              p.push(0);
            }

            node = getNodeAtPath(state.root, p);

            if (
              node.annotations.includes(annotation) &&
              node.halfMoves % 2 === colorN
            ) {
              break;
            }
          }

          state.position = p;
        }),
      ),

    makeMove: ({
      payload,
      changePosition,
      mainline,
      clock,
      changeHeaders = true,
    }) => {
      set(
        produce((state) => {
          if (typeof payload === "string") {
            const node = getNodeAtPath(state.root, state.position);
            if (!node) return;
            const [pos] = positionFromFen(node.fen);
            if (!pos) return;
            const move = parseSan(pos, payload);
            if (!move) return;
            payload = move;
          }
          makeMove({
            state,
            move: payload,
            last: false,
            changePosition,
            changeHeaders,
            mainline,
            clock,
          });
        }),
      );
    },

    appendMove: ({ payload, clock }) =>
      set(
        produce((state) => {
          makeMove({ state, move: payload, last: true, clock });
        }),
      ),

    makeMoves: ({ payload, mainline, changeHeaders = true }) =>
      set(
        produce((state) => {
          state.dirty = true;
          const node = getNodeAtPath(state.root, state.position);
          const [pos] = positionFromFen(node.fen);
          if (!pos) return;
          for (const [i, move] of payload.entries()) {
            const m = parseSanOrUci(pos, move);
            if (!m) return;
            pos.play(m);
            makeMove({
              state,
              move: m,
              last: false,
              mainline,
              sound: i === payload.length - 1,
              changeHeaders,
            });
          }
        }),
      ),
    goToEnd: () =>
      set(
        produce((state) => {
          const endPosition: number[] = [];
          let currentNode = state.root;
          while (currentNode.children.length > 0) {
            endPosition.push(0);
            currentNode = currentNode.children[0];
          }
          state.position = endPosition;
        }),
      ),
    goToStart: () =>
      set((state) => ({
        ...state,
        position: state.headers.start || [],
      })),
    goToMove: (move) =>
      set((state) => ({
        ...state,
        position: move,
      })),
    goToBranchStart: () => {
      set(
        produce((state) => {
          if (
            state.position.length > 0 &&
            state.position[state.position.length - 1] !== 0
          ) {
            state.position = state.position.slice(0, -1);
          }

          while (
            state.position.length > 0 &&
            state.position[state.position.length - 1] === 0
          ) {
            state.position = state.position.slice(0, -1);
          }
        }),
      );
    },

    goToBranchEnd: () => {
      set(
        produce((state) => {
          let currentNode = getNodeAtPath(state.root, state.position);
          while (currentNode.children.length > 0) {
            state.position.push(0);
            currentNode = currentNode.children[0];
          }
        }),
      );
    },

    nextBranch: () =>
      set(
        produce((state) => {
          if (state.position.length === 0) return;

          const parent = getNodeAtPath(state.root, state.position.slice(0, -1));
          const branchIndex = state.position[state.position.length - 1];
          const node = parent.children[branchIndex];

          // Makes the navigation more fluid and compatible with next/previous branching
          if (node.children.length >= 2 && parent.children.length <= 1) {
            state.position.push(0);
          }

          state.position = [
            ...state.position.slice(0, -1),
            (branchIndex + 1) % parent.children.length,
          ];
        }),
      ),
    previousBranch: () =>
      set(
        produce((state) => {
          if (state.position.length === 0) return;

          const parent = getNodeAtPath(state.root, state.position.slice(0, -1));
          const branchIndex = state.position[state.position.length - 1];
          const node = parent.children[branchIndex];

          // Makes the navigation more fluid and compatible with next/previous branching
          if (node.children.length >= 2 && parent.children.length <= 1) {
            state.position.push(0);
          }

          state.position = [
            ...state.position.slice(0, -1),
            (branchIndex + parent.children.length - 1) % parent.children.length,
          ];
        }),
      ),

    nextBranching: () =>
      set(
        produce((state) => {
          let node = getNodeAtPath(state.root, state.position);
          let branchCount = node.children.length;

          if (branchCount === 0) return;

          do {
            state.position.push(0);
            node = node.children[0];
            branchCount = node.children.length;
          } while (branchCount === 1);
        }),
      ),

    previousBranching: () =>
      set(
        produce((state) => {
          let node = getNodeAtPath(state.root, state.position);
          let branchCount = node.children.length;

          if (state.position.length === 0) return;

          do {
            state.position = state.position.slice(0, -1);
            node = getNodeAtPath(state.root, state.position);
            branchCount = node.children.length;
          } while (branchCount === 1 && state.position.length > 0);
        }),
      ),

    deleteMove: (path) =>
      set(
        produce((state) => {
          state.dirty = true;
          deleteMove(state, path ?? state.position);
        }),
      ),
    promoteVariation: (path) =>
      set(
        produce((state) => {
          state.dirty = true;
          promoteVariation(state, path);
        }),
      ),
    promoteToMainline: (path) =>
      set(
        produce((state) => {
          state.dirty = true;
          while (!promoteVariation(state, path)) {}
        }),
      ),
    copyVariationPgn: (path) => {
      const { root } = get();
      const pgn = getPGN(root, {
        headers: null,
        comments: false,
        extraMarkups: false,
        glyphs: true,
        variations: false,
        path,
      });
      navigator.clipboard.writeText(pgn);
    },
    setStart: (start) =>
      set(
        produce((state) => {
          state.dirty = true;
          state.headers.start = start;
        }),
      ),
    setAnnotation: (payload) =>
      set(
        produce((state) => {
          state.dirty = true;
          const node = getNodeAtPath(state.root, state.position);
          if (node) {
            if (node.annotations.includes(payload)) {
              node.annotations = node.annotations.filter((a) => a !== payload);
            } else {
              const newAnnotations = node.annotations.filter(
                (a) =>
                  !ANNOTATION_INFO[a].group ||
                  ANNOTATION_INFO[a].group !== ANNOTATION_INFO[payload].group,
              );
              node.annotations = [...newAnnotations, payload].sort((a, b) =>
                ANNOTATION_INFO[a].nag > ANNOTATION_INFO[b].nag ? 1 : -1,
              );
            }
          }
        }),
      ),
    setComment: (payload) =>
      set(
        produce((state) => {
          state.dirty = true;
          const node = getNodeAtPath(state.root, state.position);
          if (node) {
            node.comment = payload;
          }
        }),
      ),
    setHeaders: (headers) =>
      set(
        produce((state) => {
          state.dirty = true;
          state.headers = headers;
          if (headers.fen && headers.fen !== state.root.fen) {
            state.root = defaultTree(headers.fen).root;
            state.position = [];
          }
        }),
      ),
    setResult: (result) =>
      set(
        produce((state) => {
          state.dirty = true;
          state.headers.result = result;
        }),
      ),
    setShapes: (shapes) =>
      set(
        produce((state) => {
          state.dirty = true;
          setShapes(state, shapes);
        }),
      ),
    setScore: (score) =>
      set(
        produce((state) => {
          state.dirty = true;
          const node = getNodeAtPath(state.root, state.position);
          if (node) {
            node.score = score;
          }
        }),
      ),
    addAnalysis: (analysis) =>
      set(
        produce((state) => {
          state.dirty = true;
          addAnalysis(state, analysis);
        }),
      ),

    clearShapes: () =>
      set(
        produce((state) => {
          const node = getNodeAtPath(state.root, state.position);
          if (node && node.shapes.length > 0) {
            state.dirty = true;
            node.shapes = [];
          }
        }),
      ),
  });

  if (id) {
    return createStore<TreeStoreState>()(
      persist(stateCreator, {
        name: id,
        storage: createJSONStorage(() => sessionStorage),
      }),
    );
  }
  return createStore<TreeStoreState>()(stateCreator);
};

function makeMove({
  state,
  move,
  last,
  changePosition = true,
  changeHeaders = true,
  mainline = false,
  clock,
  sound = true,
}: {
  state: TreeState;
  move: Move;
  last: boolean;
  changePosition?: boolean;
  changeHeaders?: boolean;
  mainline?: boolean;
  clock?: number;
  sound?: boolean;
}) {
  const mainLine = Array.from(treeIteratorMainLine(state.root));
  const position = last
    ? mainLine[mainLine.length - 1].position
    : state.position;
  const moveNode = getNodeAtPath(state.root, position);
  if (!moveNode) return;
  const [pos] = positionFromFen(moveNode.fen);
  if (!pos) return;
  const san = makeSan(pos, move);
  if (san === "--") return; // invalid move
  pos.play(move);
  if (sound) {
    playSound(san.includes("x"), san.includes("+"));
  }
  if (changeHeaders && pos.isEnd()) {
    if (pos.isCheckmate()) {
      state.headers.result = pos.turn === "white" ? "0-1" : "1-0";
    }
    if (pos.isStalemate() || pos.isInsufficientMaterial()) {
      state.headers.result = "1/2-1/2";
    }
  }

  const newFen = makeFen(pos.toSetup());

  if (
    (changeHeaders && isThreeFoldRepetition(state, newFen)) ||
    is50MoveRule(state)
  ) {
    state.headers.result = "1/2-1/2";
  }

  const i = moveNode.children.findIndex((n) => n.san === san);
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
      fen: newFen,
      move,
      san,
      halfMoves: moveNode.halfMoves + 1,
      clock,
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
    const [pos] = positionFromFen(node.fen);
    if (!pos) return false;
    if (
      node.move &&
      isNormal(node.move) &&
      (node.move.promotion ||
        node.san?.includes("x") ||
        pos.board.get(node.move.from)?.role === "pawn")
    ) {
      count = 0;
    }
    node = node.children[i];
  }
  return count >= 100;
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
    if (state.position.length >= path.length) {
      state.position[path.length - 1] = 0;
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

function setShapes(state: TreeState, shapes: DrawShape[]) {
  const node = getNodeAtPath(state.root, state.position);
  if (!node) return state;

  const [shape] = shapes;
  if (shape) {
    const index = node.shapes.findIndex(
      (s) => s.orig === shape.orig && s.dest === shape.dest,
    );

    if (index !== -1) {
      node.shapes.splice(index, 1);
    } else {
      node.shapes.push(shape);
    }
  } else {
    node.shapes = [];
  }

  return state;
}

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
  while (cur !== undefined && i < analysis.length) {
    const [pos] = positionFromFen(cur.fen);
    if (pos && !pos.isEnd() && analysis[i].best.length > 0) {
      cur.score = analysis[i].best[0].score;
      if (analysis[i].novelty) {
        cur.annotations = [...new Set([...cur.annotations, "N" as const])];
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
      const color = cur.halfMoves % 2 === 1 ? "white" : "black";
      const annotation = getAnnotation(
        prevprevScore?.value || null,
        prevScore?.value || null,
        curScore.value,
        color,
        prevMoves,
        analysis[i].is_sacrifice,
        cur.san || "",
      );
      if (annotation) {
        cur.annotations = [...new Set([...cur.annotations, annotation])];
      }
    }
    cur = cur.children[0];
    i++;
  }
}
