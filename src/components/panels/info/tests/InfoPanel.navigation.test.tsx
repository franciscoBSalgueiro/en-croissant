// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commands } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { createTreeStore } from "@/state/store/tree";
import type { Tab } from "@/utils/tabs";
import InfoPanel from "../InfoPanel";

vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => ({ documentDir: "/games" }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));
vi.mock("@tauri-apps/plugin-log", () => ({ error: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/common/GameInfo", () => ({ default: () => null }));
vi.mock("../FenSearch", () => ({ default: () => null }));
vi.mock("../FileInfo", () => ({ default: () => null }));
vi.mock("../PgnInput", () => ({ default: () => null }));
vi.mock("../GameSelector", () => ({
  default: ({ setPage }: { setPage: (page: number) => void }) => (
    <>
      <button onClick={() => setPage(1)}>Next fixture game</button>
      <button onClick={() => setPage(2)}>Third fixture game</button>
    </>
  ),
}));
let root: Root;
let container: HTMLDivElement;
let atoms: ReturnType<typeof createStore>;
let tree: ReturnType<typeof createTreeStore>;
const source: Tab = {
  name: "Source",
  value: "source",
  type: "analysis",
  gameOrigin: {
    kind: "file",
    gameNumber: 0,
    file: {
      type: "file",
      name: "source.pgn",
      path: "/games/source.pgn",
      numGames: 3,
      metadata: { tags: [], type: "game" },
      lastModified: 0,
    },
  },
};
const other: Tab = { ...source, value: "other" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  localStorage.clear();
  sessionStorage.clear();
  atoms = createStore();
  atoms.set(tabsAtom, [source, other]);
  atoms.set(activeTabAtom, source.value);
  tree = createTreeStore();
  tree.getState().setComment("Source edits");
  vi.spyOn(commands, "writeGame").mockResolvedValue({ status: "ok", data: null });
  vi.spyOn(commands, "readGames").mockResolvedValue({ status: "ok", data: ["*"] });
  vi.spyOn(commands, "lexPgn").mockResolvedValue({
    status: "ok",
    data: [
      { type: "Header", value: { tag: "White", value: "Next game" } },
      { type: "Outcome", value: "*" },
    ],
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(
      <Provider store={atoms}>
        <MantineProvider env="test">
          <TreeStateContext.Provider value={tree}>
            <InfoPanel />
          </TreeStateContext.Provider>
        </MantineProvider>
      </Provider>,
    ),
  );
}
async function click(text: string) {
  await act(async () =>
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.includes(text))!
      .click(),
  );
}
async function requestNext() {
  await click("Untitled");
  await click("Next fixture game");
}

it("waits for save and delayed game read, suppresses competing navigation, then changes only source game", async () => {
  const write = Promise.withResolvers<Awaited<ReturnType<typeof commands.writeGame>>>();
  const read = Promise.withResolvers<Awaited<ReturnType<typeof commands.readGames>>>();
  vi.mocked(commands.writeGame).mockReturnValueOnce(write.promise);
  vi.mocked(commands.readGames).mockReturnValueOnce(read.promise);
  await render();
  const originalOther = atoms.get(tabsAtom)[1];
  await requestNext();
  await click("Save and Close");
  expect(commands.readGames).not.toHaveBeenCalled();
  await click("Third fixture game");
  await act(async () => write.resolve({ status: "ok", data: null }));
  expect(commands.readGames).toHaveBeenCalledExactlyOnceWith("/games/source.pgn", 1, 1);
  expect(atoms.get(tabsAtom)).toEqual([source, other]);
  await act(async () => read.resolve({ status: "ok", data: ["*"] }));
  expect(atoms.get(tabsAtom)[0].gameOrigin).toMatchObject({ gameNumber: 1 });
  expect(atoms.get(tabsAtom)[1]).toBe(originalOther);
  expect(tree.getState().headers.white).toBe("Next game");
});

it.each(["read", "parse"])(
  "abandons delayed %s after focus/unmount rather than mutating another tab",
  async (phase) => {
    const read = Promise.withResolvers<Awaited<ReturnType<typeof commands.readGames>>>();
    const parse = Promise.withResolvers<Awaited<ReturnType<typeof commands.lexPgn>>>();
    if (phase === "read") vi.mocked(commands.readGames).mockReturnValueOnce(read.promise);
    else vi.mocked(commands.lexPgn).mockReturnValueOnce(parse.promise);
    await render();
    await requestNext();
    await click("Close Without Saving");
    const before = tree.getState();
    await act(async () => {
      atoms.set(activeTabAtom, other.value);
      root.render(null);
    });
    await act(async () => {
      read.resolve({ status: "ok", data: ["*"] });
      parse.resolve({ status: "ok", data: [{ type: "Outcome", value: "*" }] });
    });
    expect(atoms.get(tabsAtom)).toEqual([source, other]);
    expect(tree.getState()).toBe(before);
    expect(tree.getState().dirty).toBe(true);
  },
);

it.each([
  ["read", "Close Without Saving"],
  ["parse", "Close Without Saving"],
  ["read", "Save and Close"],
  ["parse", "Save and Close"],
])("keeps new edits during %s after %s instead of replacing the source", async (phase, action) => {
  const read = Promise.withResolvers<Awaited<ReturnType<typeof commands.readGames>>>();
  const parse = Promise.withResolvers<Awaited<ReturnType<typeof commands.lexPgn>>>();
  if (phase === "read") vi.mocked(commands.readGames).mockReturnValueOnce(read.promise);
  else vi.mocked(commands.lexPgn).mockReturnValueOnce(parse.promise);
  await render();
  await requestNext();
  await click(action);
  expect(tree.getState().dirty).toBe(action !== "Save and Close");
  tree.getState().setComment("New edits during loading");
  const before = tree.getState();
  await act(async () => {
    read.resolve({ status: "ok", data: ["*"] });
    parse.resolve({ status: "ok", data: [{ type: "Outcome", value: "*" }] });
  });
  expect(atoms.get(tabsAtom)).toEqual([source, other]);
  expect(tree.getState()).toBe(before);
});
