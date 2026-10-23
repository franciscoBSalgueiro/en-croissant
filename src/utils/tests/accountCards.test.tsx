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
  // Mantine reads media queries, and measures with a ResizeObserver a frame later; jsdom has
  // neither, so the page is 700 by 500 pixels and a frame is now
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe() {
        const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 500, right: 700 };
        const entry = {
          borderBoxSize: [{ inlineSize: 700, blockSize: 500 }],
          contentRect: { ...rect, width: 700, height: 500 },
        };
        this.callback([entry] as unknown as ResizeObserverEntry[], this as never);
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
    frame(0);
    return 0;
  });
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

test("the first account added shows its card, without leaving the page", async () => {
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () =>
    root.render(
      <MantineProvider>
        <AccountCards
          databases={[]}
          setDatabases={vi.fn<() => void>()}
          onAddAccount={vi.fn<() => void>()}
        />
      </MantineProvider>,
    ),
  );
  expect(document.querySelector('img[alt="chess.com"]')).toBeNull();

  await act(async () => getDefaultStore().set(sessionsAtom, [chessCom]));

  expect(document.querySelector('img[alt="chess.com"]')).not.toBeNull();
});
