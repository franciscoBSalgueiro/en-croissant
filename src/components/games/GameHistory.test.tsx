import { SWRConfig } from "swr";
import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import GameHistory from "./GameHistory";

const { invoke, navigate } = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>(),
  navigate: vi.fn<(...args: unknown[]) => Promise<void>>(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/state/atoms", async () => {
  const { atom } = await import("jotai");
  return {
    tabsAtom: atom([]),
    activeTabAtom: atom(null),
    restoreGameSessionAtom: atom(null, () => {}),
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  sessionStorage.clear();
});
const record = {
  version: 1,
  id: "archived",
  startedAt: Date.UTC(2026, 9, 15),
  updatedAt: Date.UTC(2026, 9, 15),
  config: {
    white: { type: "human", name: "Alice" },
    black: {
      type: "engine",
      name: "Stockfish",
      path: "/stockfish",
      options: [],
      go: { t: "Depth", c: 12 },
    },
    whiteTimeControl: null,
    blackTimeControl: null,
    initialFen: null,
    initialMoves: [],
    openingBook: null,
  },
  state: {
    gameId: "old-game",
    status: "playing",
    initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    currentFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    ply: 1,
    turn: "black",
    whiteTime: null,
    blackTime: null,
    whitePlayer: "Alice",
    blackPlayer: "Stockfish",
    moves: [
      {
        uci: "e2e4",
        san: "e4",
        fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        clock: null,
        whiteTime: null,
        blackTime: null,
      },
    ],
  },
};
async function render(
  action: (host: HTMLDivElement, store: ReturnType<typeof createStore>) => Promise<void>,
  recent = false,
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addListener() {},
    removeListener() {},
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
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const store = createStore();
  try {
    await act(async () =>
      root.render(
        <SWRConfig value={{ provider: () => new Map(), errorRetryCount: 0 }}>
          <Provider store={store}>
            <MantineProvider>
              <GameHistory recent={recent} />
            </MantineProvider>
          </Provider>
        </SWRConfig>,
      ),
    );
    await action(host, store);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}
function mockGame(activeGameId: string | null = null, failResume = false) {
  invoke.mockImplementation(async (command) => {
    if (command === "list_saved_games")
      return [
        {
          id: record.id,
          startedAt: record.startedAt,
          updatedAt: record.updatedAt,
          white: "Alice",
          black: "Stockfish",
          status: "playing",
          ply: 1,
          activeGameId,
        },
      ];
    if (command === "load_saved_game") return record;
    if (command === "resume_saved_game") {
      if (failResume) throw new Error("Engine unavailable");
      return record.state;
    }
    throw new Error(`Unexpected command: ${command}`);
  });
}
const button = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll("button")].find((button) => button.textContent === name)!;

test("recovering an interrupted game restores its moves into a new play tab", async () => {
  mockGame();
  await render(async (host, store) => {
    expect(host.textContent).toContain("Interrupted");
    await act(async () => button(host, "Resume").click());
    expect(invoke).toHaveBeenCalledWith(
      "resume_saved_game",
      expect.objectContaining({ id: "archived" }),
    );
    const tab = store.get(tabsAtom)[0];
    expect(tab.type).toBe("play");
    expect(store.get(activeTabAtom)).toBe(tab.value);
    const tree = JSON.parse(sessionStorage.getItem(tab.value)!).state;
    expect(tree.root.children[0].san).toBe("e4");
    expect(tree.position).toEqual([0]);
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});
test("returning to a live backend game after UI state loss does not launch another game", async () => {
  mockGame("existing-game");
  await render(async (host, store) => {
    await act(async () => button(host, "Return to game").click());
    expect(invoke.mock.calls.some(([command]) => command === "resume_saved_game")).toBe(false);
    expect(store.get(tabsAtom)[0].value).toBe("existing");
    expect(store.get(tabsAtom)[0].type).toBe("play");
  });
});
test("a failed resume leaves the archive available and does not create an empty tab", async () => {
  mockGame(null, true);
  await render(async (host, store) => {
    await act(async () => button(host, "Resume").click());
    expect(host.textContent).toContain("Engine unavailable");
    expect(host.textContent).toContain("Alice");
    expect(store.get(tabsAtom)).toEqual([]);
  });
});
test("a storage error is visible rather than displaying a misleading empty history", async () => {
  invoke.mockRejectedValue(new Error("Unreadable saved game"));
  await render(async (host) => {
    expect(host.textContent).toContain("Unreadable saved game");
    expect(host.textContent).not.toContain("No saved games yet");
  });
});

test("recent games shows the five latest saves and links to the full history", async () => {
  invoke.mockResolvedValue(
    Array.from({ length: 7 }, (_, index) => ({
      id: `game-${index}`,
      startedAt: record.startedAt,
      updatedAt: record.updatedAt + index,
      white: `Player ${index}`,
      black: "Stockfish",
      status: "playing",
      ply: 1,
      activeGameId: null,
    })),
  );
  await render(async (host) => {
    expect(host.textContent).toContain("Recent Games");
    expect(host.textContent).not.toContain("Player 0");
    expect(host.textContent).not.toContain("Player 1");
    const text = host.textContent!;
    expect(text.indexOf("Player 6")).toBeLessThan(text.indexOf("Player 5"));
    expect(
      [...host.querySelectorAll("button")].filter((b) => b.textContent === "Analyze"),
    ).toHaveLength(5);
    await act(async () => button(host, "View all").click());
    expect(navigate).toHaveBeenCalledWith({ to: "/games" });
  }, true);
});

test("recent games can resume an interrupted game", async () => {
  mockGame();
  await render(async (host, store) => {
    await act(async () => button(host, "Resume").click());
    expect(store.get(tabsAtom)[0].type).toBe("play");
  }, true);
});
