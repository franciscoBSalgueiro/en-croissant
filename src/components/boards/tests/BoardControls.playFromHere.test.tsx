// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { INITIAL_FEN } from "chessops/fen";
import { parsePgn } from "chessops/pgn";
import { createInstance } from "i18next";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Result, Token } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  activeTabAtom,
  currentGameIdAtom,
  currentGameStateAtom,
  currentPlayersAtom,
  tabsAtom,
} from "@/state/atoms";
import { createTreeStore } from "@/state/store/tree";
import type { GameOrigin, Tab } from "@/utils/tabs";
import {
  defaultTree,
  getNodeAtPath,
  type TreeState,
  treeIteratorMainLine,
} from "@/utils/treeReducer";
import BoardControls from "../BoardControls";

const mocks = vi.hoisted(() => ({
  lexPgn: vi.fn<(pgn: string) => Promise<Result<Token[], string>>>(),
  notify: vi.fn(),
  log: vi.fn<(...args: unknown[]) => Promise<void>>(),
}));
vi.mock("@/bindings", () => ({ commands: { lexPgn: mocks.lexPgn } }));
vi.mock("@tanstack/react-router", () => ({ useLoaderData: () => ({ documentDir: "/documents" }) }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));
vi.mock("@tauri-apps/plugin-log", () => ({ error: mocks.log }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("@/utils/sound", () => ({ playSound: vi.fn() }));

const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({ lng: "en", fallbackLng: false, resources: { en: { translation: {} } } });
});

const customFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const origins: GameOrigin[] = [
  {
    kind: "file",
    gameNumber: 3,
    file: {
      type: "file",
      name: "annotated.pgn",
      path: "/games/annotated.pgn",
      numGames: 5,
      metadata: { type: "game", tags: [] },
      lastModified: 1,
    },
  },
  { kind: "database", database: "/games/archive.db3", gameId: 42 },
];
const selections = [
  {
    name: "mainline midpoint",
    fen: INITIAL_FEN,
    position: [0, 0],
    moves: ["e4", "e5"],
    text: "1. e4 e5 *",
  },
  {
    name: "side variation midpoint",
    fen: INITIAL_FEN,
    position: [0, 1, 0],
    moves: ["e4", "c5", "Nf3"],
    text: "1. e4 c5 2. Nf3 *",
  },
  { name: "initial root", fen: INITIAL_FEN, position: [], moves: [], text: "*" },
  { name: "custom black-to-move root", fen: customFen, position: [], moves: [], text: "*" },
  {
    name: "custom black-to-move midpoint",
    fen: customFen,
    position: [0, 0],
    moves: ["c5", "Nf3"],
    text: "1... c5 2. Nf3 *",
  },
];

let root: Root;
let container: HTMLDivElement;
let atoms: ReturnType<typeof createStore>;
let tree: ReturnType<typeof createTreeStore>;
let source: Tab;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  localStorage.clear();
  sessionStorage.clear();
  mocks.log.mockResolvedValue(undefined);
  // Only the native lexer is replaced. Parse the emitted PGN independently with chessops,
  // then feed tokens through the real application parsePGN/createTab/storage pipeline.
  mocks.lexPgn.mockImplementation(async (pgn) => {
    const [game] = parsePgn(pgn);
    const tokens: Token[] = [...game.headers].map(([tag, value]) => ({
      type: "Header",
      value: { tag, value },
    }));
    for (const node of game.moves.mainline()) {
      tokens.push({ type: "San", value: node.san });
    }
    tokens.push({ type: "Outcome", value: game.headers.get("Result") ?? "*" });
    return { status: "ok", data: tokens };
  });
  atoms = createStore();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderSource(
  origin = origins[0],
  selection = selections[0],
  type: Tab["type"] = "analysis",
) {
  source = { name: "Annotated source", value: "source", type, gameOrigin: origin };
  atoms.set(tabsAtom, [source]);
  atoms.set(activeTabAtom, source.value);
  atoms.set(currentGameStateAtom, "playing");
  atoms.set(currentGameIdAtom, "source-game");
  atoms.set(currentPlayersAtom, {
    white: { type: "human", name: "Source white" },
    black: { type: "human", name: "Source black" },
  });
  tree = createTreeStore(undefined, defaultTree(selection.fen));
  tree.getState().makeMoves({
    payload: selection.fen === INITIAL_FEN ? ["e4", "e5", "Nf3", "Nc6"] : ["c5", "Nf3", "d6"],
  });
  tree.getState().goToMove(selection.fen === INITIAL_FEN ? [0] : []);
  tree.getState().makeMoves({
    payload: selection.fen === INITIAL_FEN ? ["c5", "Nf3", "d6"] : ["e5", "Nf3", "Nc6"],
  });
  tree.getState().setComment("Unselected continuation");
  tree.getState().goToMove(selection.position);
  tree.getState().setComment("Keep this source annotation");
  tree.getState().setAnnotation("!!");
  tree.getState().setShapes([{ orig: "e2", dest: "e4", brush: "green" }]);
  tree.getState().setHeaders({
    ...tree.getState().headers,
    fen: selection.fen,
    id: 42,
    event: "Source event",
    site: "Source site",
    white: "Alice",
    black: "Bob",
    result: "1-0",
    start: [0, 1, 0, 0],
    orientation: "black",
  });
  await act(async () => {
    root.render(
      <Provider store={atoms}>
        <I18nextProvider i18n={i18n}>
          <MantineProvider env="test">
            <TreeStateContext.Provider value={tree}>
              <BoardControls
                editingMode={false}
                toggleEditingMode={vi.fn()}
                dirty={tree.getState().dirty}
              />
            </TreeStateContext.Provider>
          </MantineProvider>
        </I18nextProvider>
      </Provider>,
    );
  });
}
async function clickMode() {
  // The real ActionIcon has a tooltip rather than an accessible name today.
  const button = container
    .querySelector(".tabler-icon-target, .tabler-icon-zoom-check")
    ?.closest("button");
  expect(button).not.toBeNull();
  await act(async () => button!.click());
}

for (const origin of origins) {
  describe(`play from a ${origin.kind}-backed analysis`, () => {
    it.each(selections)("forks only the selected prefix: $name", async (selection) => {
      await renderSource(origin, selection);
      const originalState = tree.getState();
      const originalJson = JSON.stringify(originalState);
      const originalTab = atoms.get(tabsAtom)[0];
      const players = atoms.get(currentPlayersAtom);
      await clickMode();
      const tabs = atoms.get(tabsAtom);
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toBe(originalTab);
      expect(tabs[0]).toEqual(source);
      expect(tabs[1]).toMatchObject({ type: "play", gameOrigin: { kind: "none" } });
      expect(tabs[1].value).not.toBe(source.value);
      expect(atoms.get(activeTabAtom)).toBe(tabs[1].value);
      expect(atoms.get(currentGameStateAtom)).toBe("settingUp");
      expect(atoms.get(currentGameIdAtom)).toBeNull();
      const saved: TreeState = JSON.parse(sessionStorage.getItem(tabs[1].value)!).state;
      expect(saved.position).toEqual(selection.position.map(() => 0));
      expect(saved.headers).toMatchObject({ fen: selection.fen, result: "*", start: [] });
      expect(saved.root.fen).toBe(selection.fen);
      const line = [...treeIteratorMainLine(saved.root)].slice(1);
      expect(line.map(({ node }) => node.san)).toEqual(selection.moves);
      expect(line.every(({ node }) => node.children.length <= 1)).toBe(true);
      expect(getNodeAtPath(saved.root, saved.position).fen).toBe(
        getNodeAtPath(originalState.root, selection.position).fen,
      );
      expect(getNodeAtPath(saved.root, saved.position).children).toEqual([]);
      expect(mocks.lexPgn).toHaveBeenCalledTimes(1);
      const emitted = mocks.lexPgn.mock.calls[0][0];
      expect(emitted).toContain('[Result "*"]');
      expect(emitted).not.toMatch(/\[Start |\{|\(|\$|!!/);
      expect(emitted.split("\n\n").at(-1)?.trim()).toBe(selection.text);
      expect(emitted.includes(`[SetUp "1"]\n[FEN "${customFen}"]`)).toBe(
        selection.fen !== INITIAL_FEN,
      );
      expect(tree.getState()).toBe(originalState);
      expect(JSON.stringify(tree.getState())).toBe(originalJson);
      await act(async () => atoms.set(activeTabAtom, source.value));
      expect(atoms.get(currentGameStateAtom)).toBe("playing");
      expect(atoms.get(currentGameIdAtom)).toBe("source-game");
      expect(atoms.get(currentPlayersAtom)).toBe(players);
    });
  });
}

it.each(["rejection", "error result"])(
  "leaves source and tabs untouched on parser %s",
  async (failure) => {
    await renderSource();
    const state = tree.getState();
    const storage = { ...sessionStorage };
    if (failure === "rejection")
      mocks.lexPgn.mockRejectedValueOnce(new Error("Cannot parse selected game"));
    else
      mocks.lexPgn.mockResolvedValueOnce({ status: "error", error: "Cannot parse selected game" });
    await clickMode();
    expect(mocks.lexPgn).toHaveBeenCalledTimes(1);
    expect(atoms.get(tabsAtom)).toEqual([source]);
    expect(atoms.get(activeTabAtom)).toBe(source.value);
    expect(atoms.get(currentGameStateAtom)).toBe("playing");
    expect(tree.getState()).toBe(state);
    expect({ ...sessionStorage }).toEqual(storage);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "red",
        message: expect.stringContaining("Cannot parse selected game"),
      }),
    );
  },
);

it("keeps play-to-analysis on the existing tab without resetting runtime or tree state", async () => {
  await renderSource(origins[0], selections[0], "play");
  const state = tree.getState();
  await clickMode();
  expect(atoms.get(tabsAtom)).toEqual([{ ...source, type: "analysis" }]);
  expect(atoms.get(activeTabAtom)).toBe(source.value);
  expect(atoms.get(currentGameStateAtom)).toBe("playing");
  expect(atoms.get(currentGameIdAtom)).toBe("source-game");
  expect(tree.getState()).toBe(state);
  expect(mocks.lexPgn).not.toHaveBeenCalled();
});
