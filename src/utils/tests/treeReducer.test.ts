import { parseUci } from "chessops";
import { expect, test } from "vitest";
import treeReducer, { TreeState, defaultTree } from "../treeReducer";

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
      {
        fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
        move: parseUci("d2d4")!,
        san: "d4",
        children: [],
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

function expectState({
  res,
  initialState,
  expectedState,
}: {
  res: TreeState | void;
  initialState: TreeState;
  expectedState: TreeState;
}) {
  if (res === undefined) {
    expect(initialState).toStrictEqual(expectedState);
  } else {
    expect(res).toStrictEqual(expectedState);
  }
}

test("should handle SAVE", () => {
  const initialState = defaultTree();
  initialState.dirty = true;
  const expectedState = { ...initialState, dirty: false };
  expectState({
    res: treeReducer(initialState, { type: "SAVE" }),
    initialState,
    expectedState,
  });
});

test("should handle SET_STATE", () => {
  const initialState = defaultTree();
  initialState.headers.orientation = "black";
  initialState.headers.start = [1];
  const expectedState: TreeState = {
    ...defaultTree(),
    headers: { ...defaultTree().headers, orientation: "black", start: [1] },
  };
  expectState({
    res: treeReducer(initialState, {
      type: "SET_STATE",
      payload: initialState,
    }),
    initialState: initialState,
    expectedState,
  });
});

test("should handle RESET", () => {
  const initialState = defaultTree();
  initialState.headers.orientation = "black";
  initialState.headers.start = [1];
  const expectedState = defaultTree();
  expectState({
    res: treeReducer(initialState, { type: "RESET" }),
    initialState,
    expectedState,
  });
});

test("should handle SET_HEADERS", () => {
  const initialState = defaultTree();
  const payload = initialState.headers;
  payload.orientation = "black";
  payload.start = [1];
  const expectedState: TreeState = {
    ...defaultTree(),
    dirty: true,
    headers: { ...defaultTree().headers, orientation: "black", start: [1] },
  };
  expectState({
    res: treeReducer(initialState, {
      type: "SET_HEADERS",
      payload,
    }),
    initialState,
    expectedState,
  });
});

test("should handle SET_ORIENTATION", () => {
  const initialState = defaultTree();
  const payload = "black";
  const expectedState: TreeState = {
    ...defaultTree(),
    dirty: true,
    headers: { ...defaultTree().headers, orientation: "black" },
  };
  expectState({
    res: treeReducer(initialState, {
      type: "SET_ORIENTATION",
      payload,
    }),
    initialState,
    expectedState,
  });
});

test("should handle SET_START", () => {
  const initialState = defaultTree();
  const payload = [1];
  const expectedState: TreeState = {
    ...defaultTree(),
    dirty: true,
    headers: { ...defaultTree().headers, start: [1] },
  };
  expectState({
    res: treeReducer(initialState, {
      type: "SET_START",
      payload,
    }),
    initialState,
    expectedState,
  });
});

test("should handle MAKE_MOVE", () => {
  const initialState = defaultTree();
  const expectedState: TreeState = {
    ...defaultTree(),
    dirty: true,
    position: [0],
    root: {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      move: null,
      san: null,
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
      score: null,
      depth: null,
      halfMoves: 0,
      shapes: [],
      annotations: [],
      comment: "",
    },
  };
  expectState({
    res: treeReducer(initialState, {
      type: "MAKE_MOVE",
      payload: e4,
    }),
    initialState,
    expectedState,
  });
});

test("should handle MAKE_MOVES", () => {
  const initialState = defaultTree();
  const expectedState: TreeState = treeE4D5();
  expectedState.dirty = true;
  expectedState.root.children.splice(1);
  expectState({
    res: treeReducer(initialState, {
      type: "MAKE_MOVES",
      payload: ["e4", "d5"],
    }),
    initialState,
    expectedState,
  });
});

test("should handle GO_TO_START", () => {
  const initialState = treeE4D5();
  initialState.position = [0, 0];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [],
  };
  expectState({
    res: treeReducer(initialState, {
      type: "GO_TO_START",
    }),
    initialState,
    expectedState,
  });
});

test("should handle GO_TO_END", () => {
  const initialState = treeE4D5();
  initialState.position = [];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [0, 0],
  };
  expectState({
    res: treeReducer(initialState, {
      type: "GO_TO_END",
    }),
    initialState,
    expectedState,
  });
});

test("should handle GO_TO_NEXT", () => {
  const initialState = treeE4D5();
  initialState.position = [];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [0],
  };
  expectState({
    res: treeReducer(initialState, {
      type: "GO_TO_NEXT",
    }),
    initialState,
    expectedState,
  });
});

test("should handle GO_TO_PREVIOUS", () => {
  const initialState = treeE4D5();
  initialState.position = [0];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [],
  };
  expectState({
    res: treeReducer(initialState, {
      type: "GO_TO_PREVIOUS",
    }),
    initialState,
    expectedState,
  });
});

test("should handle GO_TO_MOVE", () => {
  const initialState = treeE4D5();
  initialState.position = [];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [0],
  };
  expectState({
    res: treeReducer(initialState, {
      type: "GO_TO_MOVE",
      payload: [0],
    }),
    initialState,
    expectedState,
  });
});

test("should handle DELETE_MOVE", () => {
  const initialState = treeE4D5();
  initialState.position = [0, 0];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [],
    dirty: true,
  };
  expectedState.root.children.splice(0, 1);
  expectState({
    res: treeReducer(initialState, {
      type: "DELETE_MOVE",
      payload: [0],
    }),
    initialState,
    expectedState,
  });
});

test("should handle SET_ANNOTATION", () => {
  const initialState = treeE4D5();
  initialState.position = [0];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [0],
    dirty: true,
  };
  expectedState.root.children[0].annotations = ["!"];
  expectState({
    res: treeReducer(initialState, {
      type: "SET_ANNOTATION",
      payload: "!",
    }),
    initialState,
    expectedState,
  });
});

test("should handle SET_COMMENT", () => {
  const initialState = treeE4D5();
  initialState.position = [0];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [0],
    dirty: true,
  };
  expectedState.root.children[0].comment = "test";
  expectState({
    res: treeReducer(initialState, {
      type: "SET_COMMENT",
      payload: "test",
    }),
    initialState,
    expectedState,
  });
});

test("should handle SET_FEN", () => {
  const initialState = treeE4D5();
  initialState.position = [0];
  const expectedState: TreeState = {
    ...defaultTree(),
    dirty: true,
    root: {
      ...defaultTree().root,
      fen: "rnbq1bnr/ppppkppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR w - - 2 3",
    },
  };
  expectState({
    res: treeReducer(initialState, {
      type: "SET_FEN",
      payload: "rnbq1bnr/ppppkppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR w - - 2 3",
    }),
    initialState,
    expectedState,
  });
});

test("should handle SET_SCORE", () => {
  const initialState = treeE4D5();
  initialState.position = [0];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [0],
    dirty: true,
  };
  expectedState.root.children[0].score = {
    type: "mate",
    value: 1,
  };

  expectState({
    res: treeReducer(initialState, {
      type: "SET_SCORE",
      payload: {
        type: "mate",
        value: 1,
      },
    }),
    initialState,
    expectedState,
  });
});

test("should handle SET_SHAPES", () => {
  const initialState = treeE4D5();
  initialState.position = [0];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [0],
    dirty: true,
  };
  expectedState.root.children[0].shapes = [
    {
      brush: "red",
      orig: "e4",
      dest: "d5",
    },
  ];

  expectState({
    res: treeReducer(initialState, {
      type: "SET_SHAPES",
      payload: [
        {
          brush: "red",
          orig: "e4",
          dest: "d5",
        },
      ],
    }),
    initialState,
    expectedState,
  });
});

test("should handle ADD_ANALYSIS", () => {
  const initialState = treeE4D5();
  initialState.position = [0];
  const analysis = [
    {
      best: [
        {
          depth: 1,
          multipv: 1,
          nodes: 1,
          score: {
            type: "cp" as const,
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
            type: "cp" as const,
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
  ];

  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [0],
    dirty: true,
  };
  expectedState.root.score = {
    type: "cp",
    value: 10,
  };
  expectedState.root.children[0].score = {
    type: "cp",
    value: 20,
  };

  expectState({
    res: treeReducer(initialState, {
      type: "ADD_ANALYSIS",
      payload: analysis,
    }),
    initialState,
    expectedState,
  });
});

test("should handle PROMOTE_VARIATION", () => {
  const initialState = treeE4D5();
  initialState.position = [1];
  const expectedState: TreeState = {
    ...treeE4D5(),
    position: [0],
    dirty: true,
  };
  const c = expectedState.root.children.shift();
  expectedState.root.children.push(c!);

  expectState({
    res: treeReducer(initialState, {
      type: "PROMOTE_VARIATION",
      payload: [1],
    }),
    initialState,
    expectedState,
  });
});

test("promote 2", () => {
  const initialState: TreeState = {
    dirty: false,
    position: [0, 1],
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
              fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              move: parseUci("e7e5")!,
              san: "e5",
              children: [],
              score: null,
              depth: null,
              halfMoves: 2,
              shapes: [],
              annotations: [],
              comment: "",
            },
            {
              fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              move: parseUci("d7d6")!,
              san: "d6",
              children: [],
              score: null,
              depth: null,
              halfMoves: 2,
              shapes: [],
              annotations: [],
              comment: "",
            },
          ],
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
    headers: {
      id: 0,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      black: "",
      white: "",
      result: "*",
      event: "",
      site: "",
    },
  };
  const expectedState: TreeState = {
    dirty: true,
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
              fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              move: parseUci("d7d6")!,
              san: "d6",
              children: [],
              score: null,
              depth: null,
              halfMoves: 2,
              shapes: [],
              annotations: [],
              comment: "",
            },
            {
              fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              move: parseUci("e7e5")!,
              san: "e5",
              children: [],
              score: null,
              depth: null,
              halfMoves: 2,
              shapes: [],
              annotations: [],
              comment: "",
            },
          ],
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
    headers: {
      id: 0,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      black: "",
      white: "",
      result: "*",
      event: "",
      site: "",
    },
  };

  expectState({
    res: treeReducer(initialState, {
      type: "PROMOTE_VARIATION",
      payload: [0, 1],
    }),
    initialState,
    expectedState,
  });
});
