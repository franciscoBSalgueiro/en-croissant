// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commands } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { createTreeStore } from "@/state/store/tree";
import type { Tab } from "@/utils/tabs";
import BoardsPage from "../BoardsPage";

vi.mock("@tanstack/react-router", () => ({ useLoaderData: () => ({ documentDir: "/games" }) }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));
vi.mock("@tauri-apps/plugin-log", () => ({ error: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-mosaic-component", () => ({ Mosaic: () => null }));
vi.mock("@/components/boards/BoardAnalysis", () => ({ default: () => null }));
vi.mock("@/components/boards/BoardGame", () => ({ default: () => null }));
vi.mock("@/components/puzzles/Puzzles", () => ({ default: () => null }));
vi.mock("../NewTabHome", () => ({ default: () => null }));
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => children,
  Droppable: ({ children }: { children: (provided: object) => ReactNode }) =>
    children({ innerRef: vi.fn(), droppableProps: {} }),
  Draggable: ({ children }: { children: (provided: object) => ReactNode }) =>
    children({ innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} }),
}));
let root: Root;
let container: HTMLDivElement;
let atoms: ReturnType<typeof createStore>;
const source: Tab = {
  name: "Source B",
  value: "source-b",
  type: "analysis",
  gameOrigin: { kind: "database", database: "/games/b.db3", gameId: 2 },
};
const other: Tab = {
  ...source,
  name: "Other A",
  value: "other-a",
  gameOrigin: { kind: "database", database: "/games/a.db3", gameId: 1 },
};
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
  atoms.set(tabsAtom, [other, source]);
  atoms.set(activeTabAtom, other.value);
  for (const tab of [source, other]) {
    const tree = createTreeStore();
    tree.getState().setComment(`Edits in ${tab.value}`);
    sessionStorage.setItem(tab.value, JSON.stringify({ version: 0, state: tree.getState() }));
  }
  vi.spyOn(commands, "writeDbGame").mockResolvedValue({ status: "ok", data: null });
  vi.spyOn(commands, "killEngines").mockResolvedValue({ status: "ok", data: null });
  vi.spyOn(commands, "abortGame").mockResolvedValue({ status: "ok", data: null });
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
          <BoardsPage />
        </MantineProvider>
      </Provider>,
    ),
  );
}
async function middleClose(name: string) {
  const tab = [...document.querySelectorAll("span")].find(
    (element) => element.textContent === name,
  );
  expect(tab).toBeDefined();
  await act(async () =>
    tab!.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true })),
  );
}
async function saveAndClose() {
  await act(async () =>
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === "Save and Close")!
      .click(),
  );
}

it.each(["analysis", "new", "play"] as const)(
  "middle-closing dirty background B while %s A is active saves and removes only B",
  async (type) => {
    const active = { ...other, type };
    atoms.set(tabsAtom, [active, source]);
    await render();
    await middleClose(source.name);
    expect(atoms.get(tabsAtom)).toEqual([active, source]);
    await saveAndClose();
    expect(commands.writeDbGame).toHaveBeenCalledExactlyOnceWith(
      "/games/b.db3",
      2,
      expect.stringContaining("Edits in source-b"),
    );
    expect(atoms.get(tabsAtom)).toEqual([active]);
    expect(atoms.get(activeTabAtom)).toBe(active.value);
    expect(commands.killEngines).toHaveBeenCalledExactlyOnceWith(source.value);
    expect(commands.abortGame).toHaveBeenCalledExactlyOnceWith(`${source.value}-game`);
  },
);

it("focus/unmount while saving cannot reopen the prompt on A or close either tab", async () => {
  await render();
  await middleClose(source.name);
  const pending = Promise.withResolvers<Awaited<ReturnType<typeof commands.writeDbGame>>>();
  vi.mocked(commands.writeDbGame).mockReturnValueOnce(pending.promise);
  await saveAndClose();
  await act(async () => atoms.set(activeTabAtom, other.value));
  await act(async () => pending.resolve({ status: "ok", data: null }));
  expect(atoms.get(tabsAtom)).toEqual([other, source]);
  expect(commands.killEngines).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(JSON.parse(sessionStorage.getItem(source.value)!).state.dirty).toBe(true);
});
