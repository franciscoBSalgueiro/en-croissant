import { Result } from "@badrap/result";
import { MantineProvider } from "@mantine/core";
import { fetch } from "@tauri-apps/plugin-http";
import i18n from "i18next";
import { getDefaultStore } from "jotai";
import { RESET } from "jotai/utils";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import ImportModal from "@/components/tabs/ImportModal";
import { recentFilesAtom, tabsAtom } from "@/state/atoms";
import en_US from "@/translation/en-US.json";
import { parsePGN } from "@/utils/chess";
import { createFile, openFile } from "@/utils/files";
import { defaultTree } from "@/utils/treeReducer";

vi.mock("@/utils/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/files")>()),
  createFile: vi.fn<typeof createFile>(),
  openFile: vi.fn<typeof openFile>(),
}));
// The real one parses in Rust
vi.mock("@/utils/chess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/chess")>()),
  parsePGN: vi.fn<typeof parsePGN>(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn<typeof fetch>() }));
vi.mock("@tauri-apps/plugin-log", () => ({
  info: vi.fn<(message: string) => Promise<void>>(),
  error: vi.fn<(message: string) => Promise<void>>(),
}));
vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => ({ documentDir: "/documents" }),
}));

const game = '[Event "Rated blitz game"]\n\n1. e4 e5 *';
let root: Root;

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ resources: { "en-US": en_US }, lng: "en-US" });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // Mantine reads the color scheme and reduced motion from media queries, which jsdom lacks
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});

beforeEach(() => {
  vi.mocked(createFile).mockImplementation(async ({ filename, filetype, dir }) =>
    Result.ok({
      type: "file",
      name: filename,
      path: `${dir}/${filename}.pgn`,
      numGames: 1,
      metadata: { type: filetype, tags: [] },
      lastModified: 0,
    }),
  );
  vi.mocked(openFile).mockResolvedValue("tab");
  vi.mocked(parsePGN).mockResolvedValue(defaultTree());
  vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => game } as Response);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.clearAllMocks();
  // Back to a single home tab and no recent files
  getDefaultStore().set(tabsAtom, RESET);
  getDefaultStore().set(recentFilesAtom, RESET);
});

async function openImportGame() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MantineProvider>
        <ImportModal
          openModal
          setOpenModal={vi.fn<() => void>()}
          setTabs={vi.fn<() => void>()}
          setActiveTab={vi.fn<() => void>()}
        />
      </MantineProvider>,
    ),
  );
}

async function chooseSource(name: string) {
  const card = [...document.querySelectorAll("p")].find((p) => p.textContent === name)!;
  await act(async () => card.click());
}

function labelled(label: string) {
  const labelElement = [...document.querySelectorAll("label")].find((l) =>
    l.textContent?.startsWith(label),
  );
  return labelElement ? document.getElementById(labelElement.htmlFor) : null;
}

// The PGN box is found as the dialog's only text area, not by its label
async function type(label: string, value: string) {
  const input = (label === "PGN" ? document.querySelector("textarea") : labelled(label)) as
    | HTMLInputElement
    | HTMLTextAreaElement;
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement | HTMLTextAreaElement;
  const setValue = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function saveToFiles(name: string) {
  await act(async () => labelled("Save to files")!.click());
  if (name) await type("Name", name);
}

async function clickImport() {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent === "Import")!;
  await act(async () => {
    button.click();
    // Let the import finish
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const homeTab = () => getDefaultStore().get(tabsAtom)[0];

test("a pasted PGN saved to files goes in a new file, and that file is what opens", async () => {
  await openImportGame();
  await type("PGN", game);
  await saveToFiles("Blitz");
  await clickImport();

  expect(createFile).toHaveBeenCalledWith({
    filename: "Blitz",
    filetype: "game",
    pgn: game,
    dir: "/documents",
  });
  // Not a temporary copy, so what's played from here is saved in the file
  expect(vi.mocked(openFile).mock.calls[0][0]).toEqual(
    expect.objectContaining({ path: "/documents/Blitz.pgn" }),
  );
});

test("an online game saved to files goes in a new file, which the game is then linked to", async () => {
  await openImportGame();
  await chooseSource("Online");
  await type("Game URL", "https://lichess.org/abcdefgh");
  await saveToFiles("Blitz");
  await clickImport();

  expect(createFile).toHaveBeenCalledWith(
    expect.objectContaining({ filename: "Blitz", pgn: game }),
  );
  expect(homeTab().gameOrigin).toEqual(
    expect.objectContaining({
      kind: "file",
      file: expect.objectContaining({ path: "/documents/Blitz.pgn" }),
    }),
  );
  expect(getDefaultStore().get(recentFilesAtom)[0]).toEqual(
    expect.objectContaining({ path: "/documents/Blitz.pgn" }),
  );
});

test.each([
  ["a pasted PGN", "PGN", "PGN", game],
  ["an online game", "Online", "Game URL", "https://lichess.org/abcdefgh"],
])(
  "saving %s to files without a name says one is needed, and imports nothing",
  async (_, source, label, value) => {
    await openImportGame();
    await chooseSource(source);
    await type(label, value);
    await saveToFiles("");
    await clickImport();

    expect(document.body.textContent).toContain("Name is required");
    expect(createFile).not.toHaveBeenCalled();
    expect(openFile).not.toHaveBeenCalled();
    expect(homeTab().type).toBe("new");
  },
);

test("only a game can be saved to files, so FEN, a position, has no such option", async () => {
  await openImportGame();
  expect(labelled("Save to files")).not.toBeNull();
  await chooseSource("Online");
  expect(labelled("Save to files")).not.toBeNull();
  await chooseSource("FEN");
  expect(labelled("Save to files")).toBeNull();
});
