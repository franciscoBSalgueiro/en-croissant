import { Result } from "@badrap/result";
import { MantineProvider } from "@mantine/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import i18n from "i18next";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import type { Directory } from "@/components/files/file";
import { CreateModal } from "@/components/files/Modals";
import CreateRepertoireModal from "@/components/tabs/CreateRepertoireModal";
import ImportModal from "@/components/tabs/ImportModal";
import en_US from "@/translation/en-US.json";
import { createFile } from "@/utils/files";
import { createTab } from "@/utils/tabs";

vi.mock("@/utils/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/files")>()),
  createFile: vi.fn<typeof createFile>(),
}));
vi.mock("@/utils/tabs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/tabs")>()),
  createTab: vi.fn<typeof createTab>(),
}));
vi.mock("@tauri-apps/plugin-dialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tauri-apps/plugin-dialog")>()),
  open: vi.fn<typeof open>(),
}));
vi.mock("@tauri-apps/plugin-fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tauri-apps/plugin-fs")>()),
  readTextFile: vi.fn<typeof readTextFile>(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn<typeof fetch>() }));
vi.mock("@tauri-apps/plugin-log", () => ({
  info: vi.fn<(message: string) => Promise<void>>(),
  error: vi.fn<(message: string) => Promise<void>>(),
}));
vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => ({ documentDir: "/documents" }),
  useNavigate: () => vi.fn<() => void>(),
}));

let roots: Root[] = [];
const setSelected = vi.fn<() => void>();

// The folder selected on the Files page, where a new file goes
const openings: Directory = {
  type: "directory",
  name: "Openings",
  path: "/documents/Openings",
  children: [],
};

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ resources: { "en-US": en_US }, lng: "en-US" });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // Mantine reads the color scheme and reduced motion from media queries, and sizes the White /
  // Black control with a ResizeObserver; jsdom has neither
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
});

function closeAll() {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  document.body.innerHTML = "";
}

afterEach(() => {
  closeAll();
  vi.clearAllMocks();
});

async function render(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<MantineProvider>{ui}</MantineProvider>));
}

// Files › New file, with the Openings folder selected
const newFile = (opened: boolean) => (
  <CreateModal
    opened={opened}
    setOpened={vi.fn<() => void>()}
    files={[]}
    setFiles={vi.fn<() => void>()}
    setSelected={setSelected}
    selected={openings}
  />
);

const importGame = (opened: boolean) => (
  <ImportModal
    openModal={opened}
    setOpenModal={vi.fn<() => void>()}
    setTabs={vi.fn<() => void>()}
    setActiveTab={vi.fn<() => void>()}
  />
);

async function openNewFile() {
  await render(newFile(true));
}

const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

// Closes the dialog, as its page does, and opens it again; each takes an animation
async function closeAndReopen(dialog: (opened: boolean) => ReactNode) {
  const root = roots[roots.length - 1];
  await act(async () => root.render(<MantineProvider>{dialog(false)}</MantineProvider>));
  await wait(500);
  await act(async () => root.render(<MantineProvider>{dialog(true)}</MantineProvider>));
  await wait(500);
}

const hasCard = (name: string) =>
  [...document.querySelectorAll("p")].some((p) => p.textContent === name);

// A file type or a game source card
async function choose(name: string) {
  const card = [...document.querySelectorAll("p")].find((p) => p.textContent === name)!;
  await act(async () => card.click());
}

function labelled(label: string) {
  const labelElement = [...document.querySelectorAll("label")].find(
    (l) => l.textContent === label,
  )!;
  return document.getElementById(labelElement.htmlFor)!;
}

async function type(label: string, value: string) {
  const input = labelled(label) as HTMLInputElement | HTMLTextAreaElement;
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement | HTMLTextAreaElement;
  const setValue = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function chooseBlack() {
  const black = document.querySelector<HTMLInputElement>('input[type="radio"][value="black"]')!;
  await act(async () => black.click());
}

async function clickCreate() {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent === "Create")!;
  await act(async () => {
    button.click();
    // Let reading the game and creating the file finish
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const created = (call = 0) => vi.mocked(createFile).mock.calls[call][0];

test("a Black repertoire made in Files › New file is the one the home screen's New Repertoire makes, in the selected folder", async () => {
  await openNewFile();
  await type("Name", "Najdorf");
  await choose("Repertoire");
  await chooseBlack();
  await clickCreate();
  const fromFiles = created(0);
  closeAll();

  await render(<CreateRepertoireModal opened setOpened={vi.fn<() => void>()} />);
  await type("Name", "Najdorf");
  await chooseBlack();
  await clickCreate();
  const fromHome = created(1);

  expect(fromFiles).toEqual({ ...fromHome, dir: "/documents/Openings" });
  // So it opens from Black's side
  expect(fromFiles.pgn).toContain('[Orientation "black"]');
});

test("Files › New file › Repertoire has no PGN box, and selects the new repertoire instead of opening it", async () => {
  await openNewFile();
  await type("Name", "Najdorf");
  await choose("Repertoire");
  // A pasted PGN couldn't take the chosen side
  expect(document.querySelector("textarea")).toBeNull();
  await clickCreate();

  expect(setSelected).toHaveBeenCalledWith(expect.objectContaining({ name: "Najdorf" }));
  expect(createTab).not.toHaveBeenCalled();
});

test("Files › New file offers no FEN, which is a position rather than a game, but Import Game still does", async () => {
  await openNewFile();
  expect(hasCard("Online")).toBe(true);
  expect(hasCard("FEN")).toBe(false);
  closeAll();

  await render(importGame(true));
  expect(hasCard("FEN")).toBe(true);
});

test("a game made from a link holds the linked game", async () => {
  const game = '[Event "Rated blitz game"]\n\n1. e4 e5 *';
  vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => game } as Response);
  await openNewFile();
  await type("Name", "Blitz");
  await choose("Online");
  await type("Game URL (lichess or chess.com)", "https://lichess.org/abcdefgh");
  await clickCreate();

  expect(created().pgn).toBe(game);
});

test("a game from a link that can't be loaded isn't created, and the dialog says why", async () => {
  await openNewFile();
  await type("Name", "Game");
  await choose("Online");
  await type("Game URL (lichess or chess.com)", "https://example.com/game/1");
  await clickCreate();

  expect(document.body.textContent).toContain(
    "Failed to load game from unsupported URL: https://example.com/game/1",
  );
  expect(createFile).not.toHaveBeenCalled();
});

test.each([
  ["is named after the file when no name was typed", "", "Kasparov - Topalov"],
  ["keeps a name that was typed", "Immortal", "Immortal"],
])("a game made from a PGN file holds its games, and %s", async (_, typed, name) => {
  const games = '[Event "Wijk aan Zee"]\n\n1. e4 d6 *';
  vi.mocked(open).mockResolvedValue("/games/Kasparov - Topalov.pgn");
  vi.mocked(readTextFile).mockResolvedValue(games);
  await openNewFile();
  if (typed) await type("Name", typed);
  await act(async () => labelled("PGN file").click());
  await clickCreate();

  expect(created()).toEqual(expect.objectContaining({ filename: name, pgn: games }));
});

test.each([
  [
    "closed without creating a file",
    async () => {
      await choose("Online");
      await type("Game URL (lichess or chess.com)", "https://lichess.org/abcdefgh");
    },
    0,
  ],
  [
    "used to create a file",
    async () => {
      await type("PGN text", "1. e4 e5 *");
      await clickCreate();
    },
    1,
  ],
])(
  "Files › New file starts empty when it's opened again after being %s",
  async (_, use, filesCreated) => {
    await openNewFile();
    await type("Name", "Blitz");
    await use();
    expect(createFile).toHaveBeenCalledTimes(filesCreated);
    await closeAndReopen(newFile);

    expect((labelled("Name") as HTMLInputElement).value).toBe("");
    // Back on a pasted or chosen PGN, with nothing in it
    expect((labelled("PGN text") as HTMLTextAreaElement).value).toBe("");
  },
);

test("Import Game starts empty when it's opened again after being closed", async () => {
  await render(importGame(true));
  await type("PGN text", "1. e4 e5 *");
  await closeAndReopen(importGame);

  expect((labelled("PGN text") as HTMLTextAreaElement).value).toBe("");
});
