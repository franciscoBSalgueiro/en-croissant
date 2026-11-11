import { MantineProvider } from "@mantine/core";
import i18n from "i18next";
import { getDefaultStore } from "jotai";
import { RESET } from "jotai/utils";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import AccountCards from "@/components/common/AccountCards";
import { sessionsAtom } from "@/state/atoms";
import en_US from "@/translation/en-US.json";
import type { Session } from "@/utils/session";

vi.mock("@/bindings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/bindings")>()),
  events: {
    progressEvent: {
      listen: async () => () => {},
      emit: vi.fn<() => Promise<void>>(),
    },
  },
}));
vi.mock("@tauri-apps/plugin-log", () => ({
  info: vi.fn<(message: string) => Promise<void>>(),
  error: vi.fn<(message: string) => Promise<void>>(),
}));

let root: Root;

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ resources: { "en-US": en_US }, lng: "en-US" });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // Mantine reads media queries, which jsdom lacks. jsdom lays nothing out either: every element
  // is 700 by 500 pixels, and no resize is ever reported, so a card shown was measured as its
  // page appeared (Mantine's useElementSize, which waits for a resize report, never shows one)
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
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 500,
        right: 700,
        width: 700,
        height: 500,
      }) as DOMRect,
  );
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  getDefaultStore().set(sessionsAtom, RESET);
});

const chessCom: Session = {
  chessCom: {
    username: "someone",
    stats: {
      chess_blitz: {
        last: { rating: 1500, date: 0, rd: 50 },
        record: { win: 10, loss: 8, draw: 2 },
      },
    },
  },
  updatedAt: 0,
} as Session;

function accountCards() {
  return (
    <MantineProvider>
      <AccountCards
        databases={[]}
        setDatabases={vi.fn<() => void>()}
        onAddAccount={vi.fn<() => void>()}
      />
    </MantineProvider>
  );
}

test("the cards are drawn with the page, so nothing below them shows in their place first", async () => {
  getDefaultStore().set(sessionsAtom, [chessCom]);
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(accountCards()));

  expect(document.querySelector('img[alt="chess.com"]')).not.toBeNull();
});

test("the first account added shows its card, without leaving the page", async () => {
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(accountCards()));
  expect(document.querySelector('img[alt="chess.com"]')).toBeNull();

  await act(async () => getDefaultStore().set(sessionsAtom, [chessCom]));

  expect(document.querySelector('img[alt="chess.com"]')).not.toBeNull();
});
