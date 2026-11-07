import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig, type Cache } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { commands, type EngineConfig } from "@/bindings";
import { enginesAtom } from "@/state/atoms";
import type { LocalEngine } from "@/utils/engines";
import EnginesPage from "../EnginesPage";

const route = vi.hoisted(() => ({ selected: 0 }));
vi.mock("@/routes/engines", () => ({ Route: { useSearch: () => route } }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn<() => void>() }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));
vi.mock("@tauri-apps/plugin-log", () => ({ error: vi.fn<(message: string) => void>() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// Keep page, controls, Jotai and SWR real; isolate native disk storage and unrelated Add UI.
vi.mock("@/state/atoms", async () => {
  const { atom } = await import("jotai");
  return { enginesAtom: atom<LocalEngine[]>([]) };
});
vi.mock("../AddEngine", () => ({ default: () => null }));

const initial: EngineConfig = {
  name: "Engine binary name",
  options: [
    {
      type: "spin",
      value: { name: "Hash", default: BigInt(16), min: BigInt(1), max: BigInt(512) },
    },
    { type: "string", value: { name: "Removed", default: "old default" } },
    { type: "string", value: { name: "Style", default: "normal" } },
  ],
};
const refreshed: EngineConfig = {
  name: "New binary name",
  options: [
    { type: "spin", value: { name: "Hash", default: BigInt(8), min: BigInt(1), max: BigInt(16) } },
    { type: "combo", value: { name: "Style", default: "solid", var: ["solid"] } },
    { type: "string", value: { name: "New option", default: "new default" } },
  ],
};
function engine(id = "one"): LocalEngine {
  return {
    id,
    type: "local",
    path: `/fixture/${id}`,
    name: `Custom ${id}`,
    version: "custom version",
    go: { t: "Depth", c: 12 },
    settings: [
      { name: "Hash", value: 32 },
      { name: "Threads", value: 2 },
      { name: "MultiPV", value: 1 },
      { name: "Removed", value: "keep me" },
      { name: "Style", value: "aggressive" },
    ],
  };
}

let root: Root;
let container: HTMLDivElement;
let store: ReturnType<typeof createStore>;
let cache: Cache<unknown>;

beforeEach(() => {
  route.selected = 0;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(commands, "fileExists").mockResolvedValue({ status: "ok", data: true });
  store = createStore();
  store.set(enginesAtom, [engine()]);
  cache = new Map();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () =>
    root.render(
      <MantineProvider env="test">
        <Provider store={store}>
          <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
            <Suspense fallback={null}>
              <EnginesPage />
            </Suspense>
          </SWRConfig>
        </Provider>
      </MantineProvider>,
    ),
  );
}
function refreshButton() {
  const button = [...container.querySelectorAll("button")].find(
    (node) => node.textContent === "Engines.Settings.Refresh",
  );
  expect(button, "an explicit refresh action must be available").toBeDefined();
  return button!;
}
function input(label: string) {
  const node = [...container.querySelectorAll("label")].find((node) => node.textContent === label);
  return node?.control instanceof HTMLInputElement ? node.control : null;
}
async function clickRefresh() {
  await act(async () => refreshButton().click());
}

test("same-path refresh updates definitions without resetting custom or removed values", async () => {
  const probe = vi
    .spyOn(commands, "getEngineConfig")
    .mockResolvedValueOnce({ status: "ok", data: initial })
    .mockResolvedValueOnce({ status: "ok", data: refreshed });
  const saved = structuredClone(await store.get(enginesAtom));
  await render();
  expect(input("Removed")?.value).toBe("keep me");
  expect(input("New option")).toBeNull();
  await clickRefresh();
  expect(probe.mock.calls).toEqual([["/fixture/one"], ["/fixture/one"]]);
  expect(input("New option")?.value).toBe("new default");
  expect(input("Removed")).toBeNull();
  expect(input("Hash")?.value).toBe("32");
  expect(await store.get(enginesAtom)).toEqual(saved);
  expect(container.textContent).toContain("Engines.Settings.RefreshHint");
});

test.each(["result", "rejection"])(
  "%s failure retains old options and allows explicit retry",
  async (kind) => {
    const probe = vi
      .spyOn(commands, "getEngineConfig")
      .mockResolvedValueOnce({ status: "ok", data: initial });
    if (kind === "result") probe.mockResolvedValueOnce({ status: "error", error: "probe failed" });
    else probe.mockRejectedValueOnce(new Error("transport failed"));
    probe.mockResolvedValueOnce({ status: "ok", data: refreshed });
    const saved = structuredClone(await store.get(enginesAtom));
    await render();
    vi.useFakeTimers();
    await clickRefresh();
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(probe).toHaveBeenCalledTimes(2);
    expect(input("Removed")?.value).toBe("keep me");
    expect(input("New option")).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Engines.Settings.RefreshError",
    );
    expect(refreshButton().disabled).toBe(false);
    expect(await store.get(enginesAtom)).toEqual(saved);
    await clickRefresh();
    expect(input("New option")?.value).toBe("new default");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(probe).toHaveBeenCalledTimes(3);
    expect(await store.get(enginesAtom)).toEqual(saved);
  },
);

test("pending refresh is disabled and late results do not alter a different selected engine", async () => {
  const pending = Promise.withResolvers<Awaited<ReturnType<typeof commands.getEngineConfig>>>();
  const probe = vi
    .spyOn(commands, "getEngineConfig")
    .mockResolvedValueOnce({ status: "ok", data: initial })
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce({ status: "ok", data: initial });
  store.set(enginesAtom, [engine(), engine("two")]);
  const saved = structuredClone(await store.get(enginesAtom));
  await render();
  await clickRefresh();
  expect(refreshButton().disabled).toBe(true);
  await clickRefresh();
  expect(probe).toHaveBeenCalledTimes(2);
  route.selected = 1;
  await render();
  expect(refreshButton().disabled).toBe(false);
  await act(async () => pending.resolve({ status: "ok", data: refreshed }));
  expect(input("New option")).toBeNull();
  expect(input("Removed")?.value).toBe("keep me");
  expect(await store.get(enginesAtom)).toEqual(saved);
  expect(probe.mock.calls).toEqual([["/fixture/one"], ["/fixture/one"], ["/fixture/two"]]);
});

test("initial probe failure is visible and can be retried without changing saved values", async () => {
  vi.spyOn(commands, "getEngineConfig")
    .mockRejectedValueOnce(new Error("engine unavailable"))
    .mockResolvedValueOnce({ status: "ok", data: initial });
  const saved = structuredClone(await store.get(enginesAtom));
  await render();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Engines.Settings.RefreshError",
  );
  await clickRefresh();
  expect(input("Removed")?.value).toBe("keep me");
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(await store.get(enginesAtom)).toEqual(saved);
});
