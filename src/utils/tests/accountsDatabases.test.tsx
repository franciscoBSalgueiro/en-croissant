import { MantineProvider } from "@mantine/core";
import i18n from "i18next";
import { getDefaultStore } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import { SWRConfig } from "swr";
import { beforeAll, expect, test, vi } from "vitest";
import Accounts from "@/components/home/Accounts";
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
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));

// The account's database: 18 of its 20 games downloaded. Reading the databases is quick on the
// first visit and still under way on the next
let readStillUnderWay = false;
const database = {
  type: "success",
  filename: "someone_chesscom.db3",
  title: "someone Chess.com",
  game_count: 18,
};
vi.mock("@/utils/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/db")>()),
  getDatabases: () => (readStillUnderWay ? new Promise(() => {}) : Promise.resolve([database])),
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
  // jsdom lays nothing out: anything measured is 700 by 500 pixels, so cards that wait for their
  // width get one
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

test("coming back to the User page shows the games bars where they were, rather than filling them up again", async () => {
  getDefaultStore().set(sessionsAtom, [chessCom]);
  // The app's one store of fetched data, kept between visits
  const fetched = new Map();
  async function visit() {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () =>
      root.render(
        <SWRConfig value={{ provider: () => fetched }}>
          <MantineProvider>
            <Accounts />
          </MantineProvider>
        </SWRConfig>,
      ),
    );
    return root;
  }
  const gamesBar = () => document.querySelector('[role="progressbar"]');

  const firstVisit = await visit();
  expect(gamesBar()?.getAttribute("aria-valuenow")).toBe("90");
  act(() => firstVisit.unmount());

  readStillUnderWay = true;
  const nextVisit = await visit();
  expect(gamesBar()?.getAttribute("aria-valuenow")).toBe("90");
  act(() => nextVisit.unmount());
});
