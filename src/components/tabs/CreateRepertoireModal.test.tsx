import { SWRConfig } from "swr";
import { MantineProvider } from "@mantine/core";
import { parsePgn } from "chessops/pgn";
import { createStore, Provider } from "jotai";
import { act, type SetStateAction } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { tabFamily } from "@/state/atoms";
import { testCatalog } from "@/utils/tests/fixtures/openingCatalog";
import CreateRepertoireModal from "./CreateRepertoireModal";

const { createFile, createTab, navigate, loadCatalog, downloadCatalog } = vi.hoisted(() => ({
  createFile: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  createTab: vi.fn<(...args: unknown[]) => Promise<string>>(),
  navigate: vi.fn<(...args: unknown[]) => void>(),
  loadCatalog: vi.fn<() => Promise<unknown>>(),
  downloadCatalog: vi.fn<() => Promise<unknown>>(),
}));
vi.mock("@/utils/openingCatalogDownload", () => ({
  loadOpeningCatalog: loadCatalog,
  downloadOpeningCatalog: downloadCatalog,
}));
vi.mock("@/utils/files", () => ({ createFile }));
vi.mock("@/utils/tabs", () => ({ createTab }));
vi.mock("@/utils/chess", () => ({ headersToPGN: () => '[Result "*"]\n\n*' }));
vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => ({ documentDir: "/documents" }),
  useNavigate: () => navigate,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/state/atoms", async () => {
  const { atom } = await import("jotai");
  const practice = atom("info");
  return {
    tabsAtom: atom([]),
    activeTabAtom: atom(null),
    addRecentFileAtom: atom(null),
    tabFamily: () => practice,
  };
});

it.each(["cached", "downloaded"])(
  "creates a saved black repertoire from a %s catalog and opens practice",
  async (source) => {
    vi.clearAllMocks();
    loadCatalog.mockResolvedValue(source === "cached" ? testCatalog : null);
    downloadCatalog.mockResolvedValue(testCatalog);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
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
    createFile.mockResolvedValue({
      isErr: false,
      value: { path: "/documents/Amar Opening.pgn", metadata: { type: "repertoire" }, numGames: 1 },
    });
    createTab.mockResolvedValue("created-repertoire");
    const store = createStore();
    const close = vi.fn<(opened: SetStateAction<boolean>) => void>();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          <SWRConfig value={{ provider: () => new Map() }}>
            <Provider store={store}>
              <MantineProvider>
                <CreateRepertoireModal opened setOpened={close} />
              </MantineProvider>
            </Provider>
          </SWRConfig>,
        );
      });
      const submit = document.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      expect(submit.disabled).toBe(true);
      if (source === "downloaded") {
        const download = [...document.querySelectorAll("button")].find(
          (button) => button.textContent === "OpeningCatalog.Download",
        );
        expect(download).toBeDefined();
        await act(async () => {
          download!.click();
        });
        expect(downloadCatalog).toHaveBeenCalledTimes(1);
      } else {
        expect(downloadCatalog).not.toHaveBeenCalled();
      }
      const picker = document.querySelector<HTMLElement>(
        'input[placeholder="OpeningCatalog.Search"]',
      )!;
      await act(async () => {
        picker.click();
      });
      const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (element) => element.textContent === "A00 · Amar Opening: Paris Gambit",
      );
      expect(option).toBeDefined();
      await act(async () => {
        option!.click();
      });
      expect(submit.disabled).toBe(false);
      await act(async () => {
        document.querySelector<HTMLInputElement>('input[type="radio"][value="black"]')!.click();
      });
      await act(async () => {
        submit.click();
      });
      expect(createFile).toHaveBeenCalledTimes(1);
      const saved = createFile.mock.calls[0][0] as {
        pgn: string;
        filetype: string;
        filename: string;
      };
      expect(saved.filetype).toBe("repertoire");
      expect(saved.filename).toBe("Amar Opening - Paris Gambit");
      const [game] = parsePgn(saved.pgn);
      expect(game.headers.get("Orientation")).toBe("black");
      expect([...game.moves.mainline()].map((move) => move.san)).toEqual([
        "Nh3",
        "d5",
        "g3",
        "e5",
        "f4",
      ]);
      expect(store.get(tabFamily("created-repertoire"))).toBe("practice");
      expect(close).toHaveBeenCalledWith(false);
      expect(navigate).toHaveBeenCalledWith({ to: "/" });
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      vi.unstubAllGlobals();
    }
  },
);
