import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { puzzleSessionsAtom } from "@/state/puzzleSessions";
import type { Puzzle } from "@/utils/puzzles";
import PuzzleSessionHistory from "./PuzzleSessionHistory";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en-US" },
  }),
}));

it("shows a saved session from a previous day and opens its exercise for analysis", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 14, 12));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const completed: Puzzle = {
    id: 12,
    fen: "8/8/8/8/8/2k5/8/K7 w - - 0 1",
    moves: ["a1a2"],
    rating: 1250,
    rating_deviation: 60,
    popularity: 80,
    nb_plays: 20,
    completion: "correct",
    timeSpent: 5000,
  };
  const session = {
    id: "previous-day",
    startedAt: new Date(2026, 9, 13, 10).getTime(),
    updatedAt: new Date(2026, 9, 13, 10, 5).getTime(),
    database: "/puzzles/lichess.db3",
    puzzles: [completed],
  };
  const sessions = [
    session,
    {
      ...session,
      id: "today-first",
      startedAt: new Date(2026, 9, 14, 10).getTime(),
      database: "today-first.db3",
    },
    {
      ...session,
      id: "today-second",
      startedAt: new Date(2026, 9, 14, 11).getTime(),
      database: "today-second.db3",
    },
  ];
  vi.stubGlobal("localStorage", {
    getItem: () => JSON.stringify(sessions),
    setItem: vi.fn<(key: string, value: string) => void>(),
    removeItem: vi.fn<(key: string) => void>(),
  });
  const store = createStore();
  store.set(puzzleSessionsAtom, sessions);
  const onInspect = vi.fn<(puzzle: Puzzle) => void>();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <Provider store={store}>
          <MantineProvider>
            <PuzzleSessionHistory onInspect={onInspect} />
          </MantineProvider>
        </Provider>,
      );
    });
    expect(container.textContent).toContain("Puzzle.SessionHistory");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain("today-first");
    expect(container.textContent).toContain("today-second");
    expect(document.body.textContent).toContain("100%");
    expect(document.body.textContent).toContain("Oct 13, 2026");
    const dayToggle = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Oct 13, 2026"),
    );
    expect(dayToggle).toBeDefined();
    expect(dayToggle!.getAttribute("aria-expanded")).toBe("false");
    const dayRegion = document.getElementById(dayToggle!.getAttribute("aria-controls")!);
    expect(getComputedStyle(dayRegion!).display).toBe("none");
    await act(async () => {
      dayToggle!.click();
    });
    expect(container.textContent).toContain("lichess");
    const sessionToggle = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("lichess"),
    );
    await act(async () => {
      sessionToggle!.click();
    });
    expect(document.body.textContent).toContain("1250");
    expect(document.body.textContent).toContain("Puzzle.HistoryCorrect");
    const sessionRegion = document.getElementById(sessionToggle!.getAttribute("aria-controls")!);
    const inspect = [...sessionRegion!.querySelectorAll("button")].find(
      (button) => button.textContent === "Puzzle.AnalyzePosition",
    );
    expect(inspect).toBeDefined();
    await act(async () => {
      inspect!.click();
    });
    expect(onInspect).toHaveBeenCalledWith(completed);
  } finally {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});
