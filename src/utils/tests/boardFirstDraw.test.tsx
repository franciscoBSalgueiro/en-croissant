import { MantineProvider } from "@mantine/core";
import { act, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import Board from "@/components/boards/Board";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import PuzzleBoard from "@/components/puzzles/PuzzleBoard";
import { createTreeStore } from "@/state/store/tree";
import { boardSize, LEFT_OF_BOARD } from "@/utils/boardLayout";

// chessground reads its size once, as it's set up, and is only redrawn into a new size later; this
// stand-in notes the width it's given at that moment (jsdom lays nothing out, so it's the inline
// width of the nearest box above it that has one)
const setUpAt: string[] = [];
vi.mock("@/chessground/Chessground", () => ({
  Chessground: () => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      let box = ref.current?.parentElement;
      while (box && !box.style.width) box = box.parentElement;
      setUpAt.push(box?.style.width ?? "none");
    }, []);
    return <div ref={ref} />;
  },
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));

// The board's pane in a laptop-sized window
const pane = { width: 763, height: 764 };
let root: Root;

beforeAll(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ ...pane, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0 }) as DOMRect,
  );
});

beforeEach(() => {
  setUpAt.length = 0;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

async function show(board: React.ReactNode) {
  await act(async () =>
    root.render(
      <MantineProvider>
        <TreeStateContext.Provider value={createTreeStore()}>{board}</TreeStateContext.Provider>
      </MantineProvider>,
    ),
  );
}

const size = boardSize(pane, window.devicePixelRatio);

test("an analysis board's chessground is set up once, at the size the board is shown at", async () => {
  await show(<Board editingMode={false} boardRef={{ current: null }} />);

  // Not first at the whole width of its pane, then redrawn a frame later
  expect(setUpAt).toEqual([`${LEFT_OF_BOARD + size}px`]);
});

test("a puzzle board's squares take an analysis board's size and place, so they keep its margin", async () => {
  await show(
    <PuzzleBoard
      puzzles={[]}
      currentPuzzle={0}
      changeCompletion={vi.fn<() => Promise<void>>()}
      generatePuzzle={vi.fn<() => Promise<void>>()}
      db={null}
    />,
  );

  // As wide as an analysis board's squares, set up at that size, and starting where they do,
  // past the room its eval bar takes
  expect(setUpAt).toEqual([`${size}px`]);
  const squares = document.querySelector<HTMLElement>(`[style*="width: ${size}px"]`);
  expect(squares?.style.marginLeft).toBe(`${LEFT_OF_BOARD}px`);
});
