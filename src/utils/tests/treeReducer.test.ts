import { Chess } from "chess.js";
import treeReducer, { TreeState, defaultTree } from "../treeReducer";
import { test, expect } from "vitest";
import { MoveAnalysis } from "../chess";

const chess = new Chess();
const e4 = chess.move("e4");
const d5 = chess.move("d5");
const treeE4D5: () => TreeState = () => ({
  ...defaultTree(),
  position: [0, 0],
  root: {
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    move: null,
    children: [
      {
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        move: e4,
        children: [
          {
            fen: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
            move: d5,
            children: [],
            score: null,
            depth: null,
            halfMoves: 2,
            shapes: [],
            annotation: "",
            commentHTML: "",
            commentText: "",
          },
        ],
        score: null,
        depth: null,
        halfMoves: 1,
        shapes: [],
        annotation: "",
        commentHTML: "",
        commentText: "",
      },
      {
        fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
        move: new Chess().move("d4"),
        children: [],
        score: null,
        depth: null,
        halfMoves: 1,
        shapes: [],
        annotation: "",
        commentHTML: "",
        commentText: "",
      },
    ],
    score: null,
    depth: null,
    halfMoves: 0,
    shapes: [],
    annotation: "",
    commentHTML: "",
    commentText: "",
  },
});

function expectState({
  res,
  initialState,
  expectedState,
}: {
  res: void | TreeState;
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
      children: [
        {
          fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          move: new Chess().move("e4"),
          children: [],
          score: null,
          depth: null,
          halfMoves: 1,
          shapes: [],
          annotation: "",
          commentHTML: "",
          commentText: "",
        },
      ],
      score: null,
      depth: null,
      halfMoves: 0,
      shapes: [],
      annotation: "",
      commentHTML: "",
      commentText: "",
    },
  };
  expectState({
    res: treeReducer(initialState, {
      type: "MAKE_MOVE",
      payload: {
        from: "e2",
        to: "e4",
      },
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
  expectedState.root.children[0].annotation = "!";
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
  expectedState.root.children[0].commentHTML = "<p>test</p>";
  expectedState.root.children[0].commentText = "test";
  expectState({
    res: treeReducer(initialState, {
      type: "SET_COMMENT",
      payload: {
        html: "<p>test</p>",
        text: "test",
      },
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
      children: [
        {
          fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          move: {
            color: "w",
            piece: "p",
            from: "e2",
            to: "e4",
            san: "e4",
            flags: "b",
            lan: "e2e4",
            before: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          },
          children: [
            {
              fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              move: {
                color: "b",
                piece: "p",
                from: "e7",
                to: "e5",
                san: "e5",
                flags: "b",
                lan: "e7e5",
                before:
                  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                after:
                  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              },
              children: [],
              score: null,
              depth: null,
              halfMoves: 2,
              shapes: [],
              annotation: "",
              commentHTML: "",
              commentText: "",
            },
            {
              fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              move: {
                color: "b",
                piece: "p",
                from: "e7",
                to: "e6",
                san: "e6",
                flags: "n",
                lan: "e7e6",
                before:
                  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                after:
                  "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              },
              children: [],
              score: null,
              depth: null,
              halfMoves: 2,
              shapes: [],
              annotation: "",
              commentHTML: "",
              commentText: "",
            },
          ],
          score: null,
          depth: null,
          halfMoves: 1,
          shapes: [],
          annotation: "",
          commentHTML: "",
          commentText: "",
        },
      ],
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
      children: [
        {
          fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          move: {
            color: "w",
            piece: "p",
            from: "e2",
            to: "e4",
            san: "e4",
            flags: "b",
            lan: "e2e4",
            before: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          },
          children: [
            {
              fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              move: {
                color: "b",
                piece: "p",
                from: "e7",
                to: "e6",
                san: "e6",
                flags: "n",
                lan: "e7e6",
                before:
                  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                after:
                  "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              },
              children: [],
              score: null,
              depth: null,
              halfMoves: 2,
              shapes: [],
              annotation: "",
              commentHTML: "",
              commentText: "",
            },
            {
              fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              move: {
                color: "b",
                piece: "p",
                from: "e7",
                to: "e5",
                san: "e5",
                flags: "b",
                lan: "e7e5",
                before:
                  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                after:
                  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
              },
              children: [],
              score: null,
              depth: null,
              halfMoves: 2,
              shapes: [],
              annotation: "",
              commentHTML: "",
              commentText: "",
            },
          ],
          score: null,
          depth: null,
          halfMoves: 1,
          shapes: [],
          annotation: "",
          commentHTML: "",
          commentText: "",
        },
      ],
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
