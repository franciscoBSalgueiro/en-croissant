import { MantineProvider } from "@mantine/core";
import { parseUci } from "chessops";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { type Cache, SWRConfig } from "swr";
import { beforeAll, expect, test, vi } from "vitest";
import OpeningName from "@/components/common/OpeningName";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { createTreeStore } from "@/state/store/tree";

// The backend's opening book, and whether a lookup is still under way
let lookupStillUnderWay = false;
vi.mock("@/bindings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/bindings")>()),
  commands: {
    getOpeningFromFens: (fens: string[]) =>
      lookupStillUnderWay
        ? new Promise(() => {})
        : Promise.resolve({
            status: "ok",
            data: fens.length === 2 ? "King's Pawn Game" : "King's Pawn Game: Open",
          }),
  },
}));

beforeAll(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});

const shownName = () => document.querySelector(".mantine-Text-root")?.textContent;

// A tab's moves list header, with the app's one store of fetched data, kept between tabs
async function showTab(tree: ReturnType<typeof createTreeStore>, fetched: Cache) {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () =>
    root.render(
      <SWRConfig value={{ provider: () => fetched }}>
        <MantineProvider>
          <TreeStateContext.Provider value={tree}>
            <OpeningName />
          </TreeStateContext.Provider>
        </MantineProvider>
      </SWRConfig>,
    ),
  );
  return root;
}

test("a tab shown again has its opening name at once, rather than none while it's looked up again", async () => {
  lookupStillUnderWay = false;
  const tree = createTreeStore();
  tree.getState().makeMove({ payload: parseUci("e2e4")! });
  const fetched = new Map();

  const shown = await showTab(tree, fetched);
  await vi.waitFor(() => expect(shownName()).toBe("King's Pawn Game"));
  act(() => shown.unmount());

  lookupStillUnderWay = true;
  const shownAgain = await showTab(tree, fetched);
  expect(shownName()).toBe("King's Pawn Game");
  act(() => shownAgain.unmount());
});

test("stepping to another move keeps the last name until the new one is known", async () => {
  lookupStillUnderWay = false;
  const tree = createTreeStore();
  tree.getState().makeMove({ payload: parseUci("e2e4")! });
  const shown = await showTab(tree, new Map());
  await vi.waitFor(() => expect(shownName()).toBe("King's Pawn Game"));

  lookupStillUnderWay = true;
  await act(async () => tree.getState().makeMove({ payload: parseUci("e7e5")! }));
  expect(shownName()).toBe("King's Pawn Game");
  act(() => shown.unmount());
});
