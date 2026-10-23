import { MantineProvider } from "@mantine/core";
import i18n from "i18next";
import { getDefaultStore } from "jotai";
import { act, Profiler } from "react";
import { createRoot } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, test, vi } from "vitest";
import BoardsPage from "@/components/tabs/BoardsPage";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import en_US from "@/translation/en-US.json";

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));
vi.mock("@/bindings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/bindings")>()),
  commands: {
    killEngines: async () => ({ status: "ok", data: null }),
    abortGame: async () => ({ status: "ok", data: null }),
  },
}));
// Each tab shows its name in place of the home screen
vi.mock("@/components/tabs/NewTabHome", () => ({
  default: ({ id }: { id: string }) => <div data-shown-tab={id} />,
}));

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ resources: { "en-US": en_US }, lng: "en-US" });
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
});

test("closing the shown tab shows the next one in the same update, never no tab at all", async () => {
  const store = getDefaultStore();
  store.set(tabsAtom, [
    { name: "First", value: "first", type: "new", gameOrigin: { kind: "none" } },
    { name: "Second", value: "second", type: "new", gameOrigin: { kind: "none" } },
  ]);
  store.set(activeTabAtom, "second");

  // What the tab area shows after each update React applies to the page
  const shownAfterEachUpdate: string[][] = [];
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () =>
    root.render(
      <MantineProvider>
        <Profiler
          id="tabs"
          onRender={() =>
            shownAfterEachUpdate.push(
              [...document.querySelectorAll("[data-shown-tab]")].map(
                (tab) => tab.getAttribute("data-shown-tab") ?? "",
              ),
            )
          }
        >
          <BoardsPage />
        </Profiler>
      </MantineProvider>,
    ),
  );
  expect(shownAfterEachUpdate.at(-1)).toEqual(["second"]);
  shownAfterEachUpdate.length = 0;

  // ⌘W closes the shown tab
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", metaKey: true }));
  });

  expect(shownAfterEachUpdate).not.toContainEqual([]);
  expect(shownAfterEachUpdate.at(-1)).toEqual(["first"]);
  act(() => root.unmount());
});
