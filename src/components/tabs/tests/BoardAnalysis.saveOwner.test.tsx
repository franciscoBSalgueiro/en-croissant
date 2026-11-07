// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { save } from "@tauri-apps/plugin-dialog";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { commands } from "@/bindings";
import BoardAnalysis from "@/components/boards/BoardAnalysis";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { activeTabAtom, autoSaveAtom, tabsAtom } from "@/state/atoms";
import { createTreeStore } from "@/state/store/tree";
import type { Tab } from "@/utils/tabs";

const callbacks = vi.hoisted(() => ({ save: () => {} }));
vi.mock("@mantine/hooks", async (original) => ({
  ...(await original<typeof import("@mantine/hooks")>()),
  useHotkeys: (keys: [string, () => void][]) => {
    const saveKey = keys.find(([key]) => key.endsWith("+s"));
    if (saveKey) callbacks.save = saveKey[1];
  },
}));
vi.mock("@mantine/core", async (original) => ({
  ...(await original<typeof import("@mantine/core")>()),
  Portal: () => null,
}));
vi.mock("@tanstack/react-router", () => ({ useLoaderData: () => ({ documentDir: "/games" }) }));
vi.mock("@tauri-apps/api/path", () => ({ resolve: async (...parts: string[]) => parts.join("/") }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// Only inspect the real owner's save callback. Unrelated board, engine and panel UI is not mounted.
vi.mock("@/components/common/DetachedEval", () => ({ default: () => null }));
vi.mock("@/components/common/GameNotation", () => ({ default: () => null }));
vi.mock("@/components/common/MoveControls", () => ({ default: () => null }));
vi.mock("@/components/panels/analysis/AnalysisPanel", () => ({ default: () => null }));
vi.mock("@/components/panels/annotation/AnnotationPanel", () => ({ default: () => null }));
vi.mock("@/components/panels/database/DatabasePanel", () => ({ default: () => null }));
vi.mock("@/components/panels/info/InfoPanel", () => ({ default: () => null }));
vi.mock("@/components/panels/practice/PracticePanel", () => ({ default: () => null }));
vi.mock("@/components/boards/Board", () => ({ default: () => null }));
vi.mock("@/components/boards/BoardControls", () => ({ default: () => null }));
vi.mock("@/components/boards/EditingCard", () => ({ default: () => null }));
vi.mock("@/components/boards/EvalListener", () => ({ default: () => null }));

it.each(["focus", "unmount"])(
  "BoardAnalysis helper completion cannot publish to the active tab after %s",
  async (change) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    localStorage.clear();
    sessionStorage.clear();
    const atoms = createStore();
    const source: Tab = {
      name: "Source",
      value: "source",
      type: "analysis",
      gameOrigin: { kind: "none" },
    };
    const other: Tab = { ...source, value: "other" };
    atoms.set(tabsAtom, [source, other]);
    atoms.set(activeTabAtom, source.value);
    atoms.set(autoSaveAtom, false);
    const tree = createTreeStore();
    tree.getState().setComment("Source edits");
    vi.mocked(save).mockResolvedValueOnce("/games/saved.pgn");
    const write = Promise.withResolvers<Awaited<ReturnType<typeof commands.writeGame>>>();
    vi.spyOn(commands, "writeGame").mockReturnValueOnce(write.promise);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <Provider store={atoms}>
            <MantineProvider env="test">
              <TreeStateContext.Provider value={tree}>
                <BoardAnalysis />
              </TreeStateContext.Provider>
            </MantineProvider>
          </Provider>,
        ),
      );
      await act(async () => {
        callbacks.save();
      });
      expect(commands.writeGame).toHaveBeenCalledTimes(1);
      await act(async () => {
        atoms.set(activeTabAtom, other.value);
        if (change === "unmount") root.render(null);
      });
      await act(async () => write.resolve({ status: "ok", data: null }));
      expect(atoms.get(tabsAtom)).toEqual([source, other]);
      expect(tree.getState().dirty).toBe(true);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.restoreAllMocks();
      vi.clearAllMocks();
      vi.unstubAllGlobals();
    }
  },
);
