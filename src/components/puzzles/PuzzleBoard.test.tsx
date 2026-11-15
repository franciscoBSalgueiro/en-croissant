import type { Config } from "@lichess-org/chessground/config";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Key } from "@lichess-org/chessground/types";
import { INITIAL_FEN } from "chessops/fen";
import { createStore, type PrimitiveAtom, Provider } from "jotai";
import { act, type ComponentProps, useReducer, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eraseDrawablesOnClickAtom, jumpToNextPuzzleAtom, showDestsAtom } from "@/state/atoms";
import { createTreeStore } from "@/state/store/tree";
import type { Completion, Puzzle } from "@/utils/puzzles";
import { getEngineArrowShapes } from "../boards/engineArrowShapes";
import { TreeStateContext } from "../common/TreeStateContext";
import PuzzleBoard from "./PuzzleBoard";

const rendered = vi.hoisted(() => ({
  config: null as Config | null,
  engineMoves: null as PrimitiveAtom<Map<number, { pv: string[]; winChance: number }[]>> | null,
}));

vi.mock("@/state/atoms", async () => {
  const { atom } = await import("jotai");
  const engineMoves = atom(new Map());
  rendered.engineMoves = engineMoves;
  return {
    bestMovesFamily: () => engineMoves,
    currentThreatAtom: atom(false),
    eraseDrawablesOnClickAtom: atom(false),
    jumpToNextPuzzleAtom: atom(false),
    moveHighlightAtom: atom(true),
    showArrowsAtom: atom(true),
    showConsecutiveArrowsAtom: atom(false),
    showCoordinatesAtom: atom("no"),
    showDestsAtom: atom(true),
  };
});
vi.mock("@/utils/sound", () => ({ playSound: vi.fn<() => void>() }));
vi.mock("@mantine/core", () => ({
  Box: ({ children, onClick, ref }: ComponentProps<"div">) => (
    <div ref={ref} onClick={onClick}>
      {children}
    </div>
  ),
}));
vi.mock("@mantine/hooks", () => ({
  useElementSize: () => ({ ref: () => {}, height: 600 }),
  useForceUpdate: () => useReducer((value) => value + 1, 0)[1],
}));
vi.mock("@/chessground/Chessground", () => ({
  Chessground: (config: Config) => {
    rendered.config = config;
    return <div data-testid="chessground" />;
  },
}));
vi.mock("../boards/PromotionModal", () => ({ default: () => null }));
vi.mock("../boards/engineArrowShapes", () => ({
  getEngineArrowShapes: vi.fn<typeof getEngineArrowShapes>(() => [
    { orig: "f1", dest: "b5", brush: "blue" },
  ]),
}));

const moves = ["e2e4", "e7e5", "g1f3", "b8c6"];
const finalFen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
const puzzle: Puzzle = {
  id: 1,
  fen: INITIAL_FEN,
  moves,
  rating: 1500,
  rating_deviation: 50,
  popularity: 100,
  nb_plays: 100,
  completion: "incomplete",
};

describe("PuzzleBoard completion and review", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    rendered.config = null;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function mount({ review = false, autoNext = false, played = 1 } = {}) {
    const tree = createTreeStore();
    tree.getState().makeMoves({ payload: moves.slice(0, played), mainline: true });
    const preferences = createStore();
    preferences.set(jumpToNextPuzzleAtom, autoNext);
    const reviewEntered = vi.fn<(fen: string) => void>();
    const completionChanged = vi.fn<(completion: Completion) => void>();
    const nextPuzzle = vi.fn<(db: string) => Promise<void>>(async () => {});
    function Harness() {
      const [current, setCurrent] = useState<Puzzle>({
        ...puzzle,
        completion: review ? "correct" : "incomplete",
      });
      const [reviewMode, setReviewMode] = useState(review);
      return (
        <Provider store={preferences}>
          <TreeStateContext.Provider value={tree}>
            <output data-testid="result">{current.completion}</output>
            <PuzzleBoard
              puzzles={[current]}
              currentPuzzle={0}
              db="puzzles.db3"
              reviewMode={reviewMode}
              enterReviewMode={() => {
                reviewEntered(tree.getState().currentNode().fen);
                setReviewMode(true);
              }}
              changeCompletion={async (completion: Completion) => {
                completionChanged(completion);
                setCurrent((previous) => ({ ...previous, completion }));
              }}
              generatePuzzle={nextPuzzle}
            />
          </TreeStateContext.Provider>
        </Provider>
      );
    }
    await act(async () => root.render(<Harness />));
    return { tree, preferences, reviewEntered, completionChanged, nextPuzzle };
  }

  async function move(from: Key, to: Key) {
    await act(async () => {
      rendered.config!.movable!.events!.after!(from, to, { premove: false });
    });
  }

  it("plays the automatic reply and enters review only after applying the final solution move", async () => {
    const { tree, completionChanged, reviewEntered, nextPuzzle } = await mount();
    await move("e7", "e5");
    expect(tree.getState().currentNode().san).toBe("Nf3");
    expect(completionChanged).not.toHaveBeenCalled();
    expect(reviewEntered).not.toHaveBeenCalled();

    await move("b8", "c6");
    expect(completionChanged).toHaveBeenCalledExactlyOnceWith("correct");
    expect(reviewEntered).toHaveBeenCalledExactlyOnceWith(finalFen);
    expect(nextPuzzle).not.toHaveBeenCalled();
    expect(rendered.config!.fen).toBe(finalFen);
    expect(rendered.config!.movable!.color).toBe("white");
    expect(container.querySelector("output")!.textContent).toBe("correct");
  });

  it("advances to the next puzzle instead of entering review when auto-next is enabled", async () => {
    const { tree, completionChanged, reviewEntered, nextPuzzle } = await mount({
      autoNext: true,
      played: 3,
    });
    await move("b8", "c6");
    expect(completionChanged).toHaveBeenCalledExactlyOnceWith("correct");
    expect(nextPuzzle).toHaveBeenCalledExactlyOnceWith("puzzles.db3");
    expect(reviewEntered).not.toHaveBeenCalled();
    expect(tree.getState().currentNode().fen).toBe(finalFen);
  });

  it("allows review moves without changing the completed puzzle result or advancing training", async () => {
    const { tree, completionChanged, reviewEntered, nextPuzzle } = await mount({
      review: true,
      played: 4,
    });
    await move("f1", "b5");
    expect(tree.getState().currentNode().san).toBe("Bb5");
    expect(rendered.config!.movable!.color).toBe("black");
    expect(container.querySelector("output")!.textContent).toBe("correct");
    expect(completionChanged).not.toHaveBeenCalled();
    expect(reviewEntered).not.toHaveBeenCalled();
    expect(nextPuzzle).not.toHaveBeenCalled();
  });

  it.each([false, true])("only displays engine analysis during review=%s", async (review) => {
    const { preferences } = await mount({ review, played: review ? 4 : 1 });
    await act(async () => {
      preferences.set(rendered.engineMoves!, new Map([[0, [{ pv: ["f1b5"], winChance: 50 }]]]));
    });
    expect(rendered.config!.drawable!.autoShapes).toEqual(
      review ? [{ orig: "f1", dest: "b5", brush: "blue" }] : [],
    );
    expect(vi.mocked(getEngineArrowShapes).mock.calls.length > 0).toBe(review);
  });

  it.each([false, true])(
    "preserves drawing and destination preferences in review=%s",
    async (review) => {
      const { tree, preferences } = await mount({ review, played: review ? 4 : 1 });
      const shapes: DrawShape[] = [{ orig: "e2", dest: "e4", brush: "green" }];
      expect(rendered.config!.movable!.showDests).toBe(true);
      await act(async () => {
        preferences.set(showDestsAtom, false);
        rendered.config!.drawable!.onChange!(shapes);
      });
      expect(rendered.config!.movable!.showDests).toBe(false);
      expect(tree.getState().currentNode().shapes).toEqual(shapes);
      expect(rendered.config!.drawable!.autoShapes).toEqual(shapes);

      const board = container.querySelector('[data-testid="chessground"]')!;
      await act(async () => board.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(tree.getState().currentNode().shapes).toEqual(shapes);
      await act(async () => preferences.set(eraseDrawablesOnClickAtom, true));
      await act(async () => board.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(tree.getState().currentNode().shapes).toEqual([]);
      expect(rendered.config!.drawable!.autoShapes).toEqual([]);
    },
  );
});
