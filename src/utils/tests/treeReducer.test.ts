import { createTreeStore } from "@/state/store";
import { type TreeState, defaultTree } from "@/utils/treeReducer";
import { parseUci } from "chessops";
import { beforeEach, expect, test } from "vitest";

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
});

const getNewState = () => {
  const s = store.getState();
  return {
    root: s.root,
    position: s.position,
    headers: s.headers,
    dirty: s.dirty,
  };
};

test("should handle SAVE", () => {
  store.setState({ dirty: true });
  store.getState().save();

  expect(getNewState()).toStrictEqual({ ...defaultTree(), dirty: false });
});

test("should handle SET_STATE", () => {
  store.getState().setState(treeE4D5());
  expect(getNewState()).toStrictEqual(treeE4D5());
});

test("should handle RESET", () => {
  store.setState(treeE4D5());
  store.getState().reset();
  expect(getNewState()).toStrictEqual(defaultTree());
});

test("should handle SET_HEADERS", () => {
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
  });
});

test("should handle SET_START", () => {
  store.getState().setStart([1]);

  expect(getNewState()).toStrictEqual({
    ...defaultTree(),
    dirty: true,
    headers: { ...defaultTree().headers, start: [1] },
  });
});

test("should handle MAKE_MOVE", () => {
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
  });
});

test("should handle MAKE_MOVES", () => {
  store.getState().makeMoves({ payload: ["e4", "d5"] });

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    dirty: true,
    position: [0, 0],
  });
});

test("should handle GO_TO_START", () => {
  store.setState(treeE4D5());
  store.getState().goToStart();

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [],
  });
});

test("should handle GO_TO_END", () => {
  store.setState({ ...treeE4D5(), position: [] });
  store.getState().goToEnd();

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [0, 0],
  });
});

test("should handle GO_TO_NEXT", () => {
  store.setState({ ...treeE4D5(), position: [] });
  store.getState().goToNext();

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [0],
  });
});

test("should handle GO_TO_PREVIOUS", () => {
  store.setState({ ...treeE4D5(), position: [0] });
  store.getState().goToPrevious();

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [],
  });
});

test("should handle GO_TO_MOVE", () => {
  store.setState({ ...treeE4D5(), position: [] });
  store.getState().goToMove([0]);

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [0],
  });
});

test("should handle DELETE_MOVE", () => {
  store.setState(treeE4D5());
  store.getState().deleteMove([0]);

  expect(getNewState()).toStrictEqual({ ...defaultTree(), dirty: true });
});

test("should handle SET_ANNOTATION", () => {
  store.setState({ ...treeE4D5(), position: [0] });
  store.getState().setAnnotation("!");

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    dirty: true,
    position: [0],
    root: {
      ...treeE4D5().root,
      children: [
        {
          ...treeE4D5().root.children[0],
          annotations: ["!"],
        },
      ],
    },
  });
});

test("should handle SET_COMMENT", () => {
  store.setState({ ...treeE4D5(), position: [0] });
  store.getState().setComment("test");

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    dirty: true,
    position: [0],
    root: {
      ...treeE4D5().root,
      children: [
        {
          ...treeE4D5().root.children[0],
          comment: "test",
        },
      ],
    },
  });
});

test("should handle SET_FEN", () => {
  store.setState({ ...treeE4D5(), position: [0] });
  store
    .getState()
    .setFen("rnbq1bnr/ppppkppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR w - - 2 3");

  expect(getNewState()).toStrictEqual({
    ...defaultTree(),
    dirty: true,
    root: {
      ...defaultTree().root,
      fen: "rnbq1bnr/ppppkppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR w - - 2 3",
    },
  });
});

test("should handle SET_SCORE", () => {
  store.setState({ ...treeE4D5(), position: [0] });
  store.getState().setScore({
    type: "mate",
    value: 1,
  });

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    dirty: true,
    position: [0],
    root: {
      ...treeE4D5().root,
      children: [
        {
          ...treeE4D5().root.children[0],
          score: {
            type: "mate",
            value: 1,
          },
        },
      ],
    },
  });
});

test("should handle SET_SHAPES", () => {
  store.setState({ ...treeE4D5(), position: [0] });
  store.getState().setShapes([
    {
      brush: "red",
      orig: "e4",
      dest: "d5",
    },
  ]);

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    dirty: true,
    position: [0],
    root: {
      ...treeE4D5().root,
      children: [
        {
          ...treeE4D5().root.children[0],
          shapes: [
            {
              brush: "red",
              orig: "e4",
              dest: "d5",
            },
          ],
        },
      ],
    },
  });
});

test("should handle ADD_ANALYSIS", () => {
  store.setState({ ...treeE4D5(), position: [0] });
  store.getState().addAnalysis([
    {
      best: [
        {
          depth: 1,
          multipv: 1,
          nodes: 1,
          score: {
            type: "cp",
            value: 10,
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
            type: "cp",
            value: 20,
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

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    dirty: true,
    position: [0],
    root: {
      ...treeE4D5().root,
      children: [
        {
          ...treeE4D5().root.children[0],
          score: {
            type: "cp",
            value: 20,
          },
        },
      ],
      score: {
        type: "cp",
        value: 10,
      },
    },
  });
});

test("should handle PROMOTE_VARIATION", () => {
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
  });
});
