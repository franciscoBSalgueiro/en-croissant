import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { fetch } from "@tauri-apps/plugin-http";
import i18n from "i18next";
import { getDefaultStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import ImportModal from "@/components/tabs/ImportModal";
import { tabsAtom } from "@/state/atoms";
import en_US from "@/translation/en-US.json";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn<typeof fetch>() }));
vi.mock("@tauri-apps/plugin-log", () => ({
  info: vi.fn<(message: string) => Promise<void>>(),
  error: vi.fn<(message: string) => Promise<void>>(),
}));
vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => ({ documentDir: "/documents" }),
}));

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
  vi.spyOn(notifications, "show").mockReturnValue("");
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.mocked(notifications.show).mockClear();
});

async function openImportGame() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MantineProvider>
        <ImportModal
          openModal
          setOpenModal={vi.fn<() => void>()}
          setTabs={vi.fn<() => void>()}
          setActiveTab={vi.fn<() => void>()}
        />
      </MantineProvider>,
    );
  });
}

async function chooseSource(name: string) {
  const card = [...document.querySelectorAll("p")].find((p) => p.textContent === name)!;
  await act(async () => card.click());
}

async function type(label: string, value: string) {
  const labelElement = [...document.querySelectorAll("label")].find(
    (l) => l.textContent === label,
  )!;
  const input = document.getElementById(labelElement.htmlFor) as HTMLInputElement;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function clickImport() {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent === "Import")!;
  await act(async () => {
    button.click();
    // Let the import finish
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// The home screen's tab, which a successful import turns into the imported game
const openTabs = () =>
  getDefaultStore()
    .get(tabsAtom)
    .map((tab) => tab.type);

beforeEach(() => {
  // Both sites answer a game that doesn't exist with 404
  vi.mocked(fetch).mockResolvedValue({
    ok: false,
    status: 404,
    statusText: "Not Found",
  } as Response);
});

async function importLink(link: string) {
  await openImportGame();
  await chooseSource("Online");
  await type("Game URL (lichess or chess.com)", link);
  await clickImport();
}

test.each([
  [
    "a Lichess game that can't be found",
    "https://lichess.org/abcdefgh",
    "Failed to load Lichess game",
  ],
  ["a Lichess link that isn't to a game", "https://lichess.org/", "Failed to load Lichess game"],
  [
    "a link to neither site",
    "https://example.com/game/1",
    "Failed to load game from unsupported URL: https://example.com/game/1",
  ],
])("importing %s says why it failed instead of doing nothing", async (_, link, reason) => {
  await importLink(link);

  expect(document.body.textContent).toContain(reason);
  expect(openTabs()).toEqual(["new"]);
});

// Chess.com failures already had a notification with the details. Lichess ones now say the same
// thing, with only the site and its example link changed
const unsupported = (example: string) => () => ({
  title: "Unsupported URL format",
  message: `The URL format is not recognized. Please use a direct game link like ${example}`,
});
const notFound = (site: string, domain: string) => (link: string) => ({
  title: `Failed to fetch ${site} game`,
  message: `Could not find game "${link}" on ${domain}`,
});

test.each([
  [
    "a Chess.com link that isn't to a game",
    "https://www.chess.com/game/abc",
    unsupported("https://www.chess.com/game/live/12345"),
  ],
  [
    "a Lichess link that isn't to a game",
    "https://lichess.org/",
    unsupported("https://lichess.org/game/abcdefg/white"),
  ],
  [
    "a Chess.com game that can't be found",
    "https://www.chess.com/game/live/12345",
    notFound("Chess.com", "chess.com"),
  ],
  [
    "a Lichess game that can't be found",
    "https://lichess.org/abcdefgh",
    notFound("Lichess", "lichess.org"),
  ],
  // Not an unsupported link: Chess.com links work without https:// too
  [
    "a Lichess game link without https:// whose game can't be found",
    "lichess.org/game/abcdefgh",
    notFound("Lichess", "lichess.org"),
  ],
  // A site's name is the same site in any case, as typed or auto-capitalized
  [
    "a Chess.com link with a capital C that isn't to a game",
    "Chess.com/12345",
    unsupported("https://www.chess.com/game/live/12345"),
  ],
  [
    "a Chess.com event link with a capital C",
    "https://www.Chess.com/events/2024-world-championship",
    () => ({
      title: "Event URLs not supported",
      message: "Event URLs cannot be imported directly. Please import the PGN instead.",
    }),
  ],
  [
    "a Lichess game link with a capital L whose game can't be found",
    "https://Lichess.org/abcdefgh",
    notFound("Lichess", "lichess.org"),
  ],
  [
    "a Lichess game link with a capital L and without https:// whose game can't be found",
    "Lichess.org/game/abcdefgh",
    notFound("Lichess", "lichess.org"),
  ],
])("importing %s also explains it in a notification", async (_, link, expected) => {
  await importLink(link);

  expect(notifications.show).toHaveBeenCalledWith(
    expect.objectContaining({ ...expected(link), color: "red" }),
  );
});

test("a Lichess link with a capitalized site name asks Lichess for the game with its ID unchanged", async () => {
  // Lichess game IDs are case-sensitive, so only the site's name may be read in any case
  await importLink("https://Lichess.org/AbCdEfGh");

  expect(fetch).toHaveBeenCalledWith("https://lichess.org/game/export/AbCdEfGh");
});

test.each([
  ["Chess.com", "https://www.chess.com/game/live/12345"],
  ["Lichess", "https://lichess.org/abcdefgh"],
])(
  "a lost connection importing from %s isn't reported as a game that can't be found",
  async (_, link) => {
    vi.mocked(fetch).mockRejectedValue(new Error("error sending request"));
    await importLink(link);

    expect(document.body.textContent).toContain("error sending request");
    expect(notifications.show).not.toHaveBeenCalled();
  },
);

test("an invalid FEN is explained in words, not shown as a translation key", async () => {
  await openImportGame();
  await chooseSource("FEN");
  // The starting position with a halfmove count that isn't a number
  await type("FEN", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - x 1");
  await clickImport();

  expect(document.body.textContent).toContain("Invalid halfmove number");
  expect(document.body.textContent).not.toContain("Errors.");
  expect(openTabs()).toEqual(["new"]);
});
