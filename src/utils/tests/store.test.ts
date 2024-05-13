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
const e5 = parseUci("e7e5")!;
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

test("should handle save", () => {
  store.setState({ dirty: true });
  store.getState().save();

  expect(getNewState()).toStrictEqual({ ...defaultTree(), dirty: false });
});

test("should handle setState", () => {
  store.getState().setState(treeE4D5());
  expect(getNewState()).toStrictEqual(treeE4D5());
});

test("should handle reset", () => {
  store.setState(treeE4D5());
  store.getState().reset();
  expect(getNewState()).toStrictEqual(defaultTree());
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
  });
});

test("should handle setStart", () => {
  store.getState().setStart([1]);

  expect(getNewState()).toStrictEqual({
    ...defaultTree(),
    dirty: true,
    headers: { ...defaultTree().headers, start: [1] },
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
  });
});

test("should handle makeMoves", () => {
  store.getState().makeMoves({ payload: ["e4", "d5"] });

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    dirty: true,
    position: [0, 0],
  });
});

test("should handle goToStart", () => {
  store.setState(treeE4D5());
  store.getState().goToStart();

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [],
  });
});

test("should handle goToEnd", () => {
  store.setState({ ...treeE4D5(), position: [] });
  store.getState().goToEnd();

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [0, 0],
  });
});

test("should handle goToNext", () => {
  store.setState({ ...treeE4D5(), position: [] });
  store.getState().goToNext();

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [0],
  });
});

test("should handle goToPrevious", () => {
  store.setState({ ...treeE4D5(), position: [0] });
  store.getState().goToPrevious();

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [],
  });
});

test("should handle goToBranchEnd", () => {
  store.setState({ ...treeE4D5(), position: [] });
  store.getState().goToBranchEnd();

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [0, 0],
  });
});

test("should handle goToBranchStart", () => {
  store.setState({ ...treeE4D5(), position: [0, 0] });
  store.getState().goToBranchStart();

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [],
  });
});

test("should handle goToMove", () => {
  store.setState({ ...treeE4D5(), position: [] });
  store.getState().goToMove([0]);

  expect(getNewState()).toStrictEqual({
    ...treeE4D5(),
    position: [0],
  });
});

test("should handle deleteMove", () => {
  store.setState(treeE4D5());
  store.getState().deleteMove([0]);

  expect(getNewState()).toStrictEqual({ ...defaultTree(), dirty: true });
});

test("should handle setAnnotation", () => {
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

test("should handle setComment", () => {
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

test("should handle setFen", () => {
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

test("should handle setScore", () => {
  store.setState({ ...treeE4D5(), position: [0] });
  store.getState().setScore({
    value: {
      type: "mate",
      value: 1,
    },
    wdl: null,
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
            value: {
              type: "mate",
              value: 1,
            },
            wdl: null,
          },
        },
      ],
    },
  });
});

test("should handle setShapes", () => {
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
            value: {
              type: "cp",
              value: 20,
            },
            wdl: null,
          },
        },
      ],
      score: {
        value: {
          type: "cp",
          value: 10,
        },
        wdl: null,
      },
    },
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
  });
});
