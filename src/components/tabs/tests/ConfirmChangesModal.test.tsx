// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { save } from "@tauri-apps/plugin-dialog";
import { copyFile } from "@tauri-apps/plugin-fs";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commands } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { createTreeStore } from "@/state/store/tree";
import type { Tab } from "@/utils/tabs";
import ConfirmChangesModal from "../ConfirmChangesModal";

vi.mock("@tanstack/react-router", () => ({ useLoaderData: () => ({ documentDir: "/games" }) }));
vi.mock("@tauri-apps/api/path", () => ({ resolve: async (...parts: string[]) => parts.join("/") }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", { spy: true });
vi.mock("@tauri-apps/plugin-log", () => ({ error: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));

let root: Root;
let container: HTMLDivElement;
let atoms: ReturnType<typeof createStore>;
let tree: ReturnType<typeof createTreeStore>;
let source: Tab;
const close = vi.fn();
const toggle = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  localStorage.clear();
  sessionStorage.clear();
  atoms = createStore();
  tree = createTreeStore();
  tree.getState().setComment("Keep my edits");
  source = {
    name: "Source",
    value: "source",
    type: "analysis",
    gameOrigin: { kind: "database", database: "/games/source.db3", gameId: 4 },
  };
  atoms.set(tabsAtom, [source, { ...source, value: "other" }]);
  atoms.set(activeTabAtom, source.value);
  vi.spyOn(commands, "writeGame").mockResolvedValue({ status: "ok", data: null });
  vi.spyOn(commands, "writeDbGame").mockResolvedValue({ status: "ok", data: null });
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
            <ConfirmChangesModal opened toggle={toggle} closeTab={close} />
          </TreeStateContext.Provider>
        </MantineProvider>
      </Provider>,
    ),
  );
}
function button(label: string) {
  const result = [...document.querySelectorAll("button")].find(
    (element) => element.textContent === label,
  );
  expect(result).toBeDefined();
  return result!;
}
async function click(label = "Save and Close") {
  await act(async () => button(label).click());
}

it("waits for the write, guards same-tick and later duplicate and competing clicks, then closes once", async () => {
  const write = Promise.withResolvers<Awaited<ReturnType<typeof commands.writeDbGame>>>();
  vi.mocked(commands.writeDbGame).mockReturnValueOnce(write.promise);
  await render();
  await act(async () => {
    button("Save and Close").click();
    button("Save and Close").click();
    button("Close Without Saving").click();
  });
  expect(commands.writeDbGame).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  expect(toggle).not.toHaveBeenCalled();
  expect(button("Save and Close").disabled).toBe(true);
  await click();
  await act(async () =>
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  expect(toggle).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  await act(async () => write.resolve({ status: "ok", data: null }));
  expect(tree.getState().dirty).toBe(false);
  expect(close).toHaveBeenCalledTimes(1);
  expect(toggle).toHaveBeenCalledTimes(1);
});

it.each(["native", "transport"])(
  "keeps %s failures visible and retryable without duplicate notifications",
  async (failure) => {
    if (failure === "native")
      vi.mocked(commands.writeDbGame).mockResolvedValueOnce({
        status: "error",
        error: "Database locked",
      });
    else vi.mocked(commands.writeDbGame).mockRejectedValueOnce(new Error("Database locked"));
    await render();
    await click();
    expect(close).not.toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled();
    expect(tree.getState().dirty).toBe(true);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Database locked");
    expect(notifications.show).toHaveBeenCalledTimes(failure === "native" ? 1 : 0);
    await click();
    expect(close).toHaveBeenCalledTimes(1);
    expect(commands.writeDbGame).toHaveBeenCalledTimes(2);
  },
);

it("does not close during a picker or on cancellation and can retry", async () => {
  source = { ...source, gameOrigin: { kind: "none" } };
  atoms.set(tabsAtom, [source]);
  const picker = Promise.withResolvers<string | null>();
  vi.mocked(save).mockReturnValueOnce(picker.promise).mockResolvedValueOnce("/games/saved.pgn");
  await render();
  await click();
  expect(close).not.toHaveBeenCalled();
  expect(commands.writeGame).not.toHaveBeenCalled();
  await act(async () => picker.resolve(null));
  expect(close).not.toHaveBeenCalled();
  expect(tree.getState().dirty).toBe(true);
  await click();
  expect(close).toHaveBeenCalledTimes(1);
  expect(atoms.get(tabsAtom)[0].gameOrigin).toMatchObject({
    kind: "file",
    file: { path: "/games/saved.pgn" },
  });
});

it("does not clean or close edits made after the save snapshot", async () => {
  const write = Promise.withResolvers<Awaited<ReturnType<typeof commands.writeDbGame>>>();
  vi.mocked(commands.writeDbGame).mockReturnValueOnce(write.promise);
  await render();
  await click();
  tree.getState().setComment("New edits during write");
  await act(async () => write.resolve({ status: "ok", data: null }));
  expect(tree.getState().dirty).toBe(true);
  expect(close).not.toHaveBeenCalled();
  await click();
  expect(close).toHaveBeenCalledTimes(1);
});

it.each(["focus", "unmount"])(
  "cannot publish, clean or close another tab after %s changes during a write",
  async (change) => {
    source = { ...source, gameOrigin: { kind: "none" } };
    const other = atoms.get(tabsAtom)[1];
    atoms.set(tabsAtom, [source, other]);
    vi.mocked(save).mockResolvedValueOnce("/games/source.pgn");
    const write = Promise.withResolvers<Awaited<ReturnType<typeof commands.writeGame>>>();
    vi.mocked(commands.writeGame).mockReturnValueOnce(write.promise);
    await render();
    await click();
    expect(commands.writeGame).toHaveBeenCalledTimes(1);
    await act(async () => {
      atoms.set(activeTabAtom, other.value);
      if (change === "unmount") root.render(null);
    });
    await act(async () => write.resolve({ status: "ok", data: null }));
    expect(atoms.get(tabsAtom)).toEqual([source, other]);
    expect(tree.getState().dirty).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled();
  },
);

it("preserves Escape cancellation while idle", async () => {
  await render();
  await act(async () =>
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  expect(toggle).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
});

it("does not close a newer edit triggered at save completion", async () => {
  const unsubscribe = tree.subscribe((state, previous) => {
    if (previous.dirty && !state.dirty) state.setComment("Edit at completion");
  });
  await render();
  await click();
  expect(tree.getState().dirty).toBe(true);
  expect(close).not.toHaveBeenCalled();
  unsubscribe();
});

it("does not save or close a replacement game while the confirmation is open", async () => {
  await render();
  await act(async () =>
    atoms.set(tabsAtom, (tabs) =>
      tabs.map((tab) =>
        tab.value === source.value
          ? { ...tab, gameOrigin: { kind: "database", database: "/games/source.db3", gameId: 99 } }
          : tab,
      ),
    ),
  );
  await click();
  expect(commands.writeDbGame).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(tree.getState().dirty).toBe(true);
});

it.each(["dialog", "copy"])("keeps %s rejection observable and retryable", async (failure) => {
  source = {
    ...source,
    gameOrigin:
      failure === "dialog"
        ? { kind: "none" }
        : {
            kind: "temp_file",
            gameNumber: 1,
            file: {
              type: "file",
              path: "/temp/source.pgn",
              name: "source.pgn",
              numGames: 2,
              metadata: { type: "game", tags: [] },
              lastModified: 0,
            },
          },
  };
  atoms.set(tabsAtom, [source]);
  vi.mocked(save).mockResolvedValue("/games/saved.pgn");
  vi.mocked(copyFile).mockResolvedValue(undefined);
  if (failure === "dialog") vi.mocked(save).mockRejectedValueOnce(new Error("Picker failed"));
  else vi.mocked(copyFile).mockRejectedValueOnce(new Error("Copy failed"));
  await render();
  await click();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("failed");
  expect(close).not.toHaveBeenCalled();
  expect(commands.writeGame).not.toHaveBeenCalled();
  expect(atoms.get(tabsAtom)).toEqual([source]);
  expect(tree.getState().dirty).toBe(true);
  await click();
  expect(close).toHaveBeenCalledTimes(1);
});

it("preserves overlay cancellation while idle", async () => {
  await render();
  const overlay = document.querySelector<HTMLElement>(".mantine-Modal-overlay");
  expect(overlay).not.toBeNull();
  await act(async () => overlay!.click());
  expect(toggle).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
});
