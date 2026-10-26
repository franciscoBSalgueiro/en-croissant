import { MantineProvider } from "@mantine/core";
import { getDefaultStore } from "jotai";
import type { PostHog } from "posthog-js";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  init: vi.fn<PostHog["init"]>(),
  capture: vi.fn<PostHog["capture"]>(),
  optIn: vi.fn<PostHog["opt_in_capturing"]>(),
  optOut: vi.fn<PostHog["opt_out_capturing"]>(),
  getVersion: vi.fn<() => Promise<string>>(async () => "test-version"),
  info: vi.fn<(message: string) => void>(),
}));
vi.mock("posthog-js", () => ({
  default: {
    init: mocks.init,
    capture: mocks.capture,
    opt_in_capturing: mocks.optIn,
    opt_out_capturing: mocks.optOut,
  },
}));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: mocks.getVersion }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/plugin-cli", () => ({
  getMatches: async () => ({ args: { file: { occurrences: 0 } } }),
}));
vi.mock("@tauri-apps/plugin-deep-link", () => ({
  getCurrent: async () => null,
  onOpenUrl: async () => () => {},
}));
vi.mock("@tauri-apps/plugin-log", () => ({
  attachConsole: async () => () => {},
  info: mocks.info,
  error: () => {},
  warn: () => {},
}));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: async () => null }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: () => {}, open: () => {}, save: () => {} }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: () => {} }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));
vi.mock("@/bindings", () => ({ commands: { closeSplashscreen: async () => {} } }));
vi.mock("@/utils/http", () => ({ initUserAgent: async () => {} }));
vi.mock("@/utils/launch", () => ({ handleDeepLink: () => {}, openCommandLineFile: () => {} }));
vi.mock("@/routeTree.gen", () => ({ routeTree: {} }));
vi.mock("@/components/ErrorComponent", () => ({ default: () => null }));
vi.mock("@tanstack/react-router", () => ({
  createRouter: () => ({ navigate: () => {} }),
  RouterProvider: () => null,
  useLoaderData: () => ({
    dirs: { documentDir: "/test", databasesDir: "/test", enginesDir: "/test", puzzlesDir: "/test" },
    version: "test-version",
  }),
}));
vi.mock("@mantine/notifications", () => ({ Notifications: () => null }));
vi.mock("mantine-contextmenu", () => ({
  ContextMenuProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("react-dnd", () => ({ DndProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("react-dnd-html5-backend", () => ({ HTML5Backend: {} }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
// Keep the real settings page, Mantine switch, React and Jotai consent path.
// Unrelated settings widgets and native startup work are outside this slice.
vi.mock("@/components/common/FileInput", () => ({ default: () => null }));
vi.mock("@/components/settings/BoardSelect", () => ({ default: () => null }));
vi.mock("@/components/settings/ColorControl", () => ({ default: () => null }));
vi.mock("@/components/settings/DimensionToggle", () => ({ default: () => null }));
vi.mock("@/components/settings/FontSizeSlider", () => ({ default: () => null }));
vi.mock("@/components/settings/KeybindInput", () => ({ default: () => null }));
vi.mock("@/components/settings/PiecesSelect", () => ({ default: () => null }));
vi.mock("@/components/settings/RepertoireMinGamesSetting", () => ({ default: () => null }));
vi.mock("@/components/settings/SoundSelect", () => ({ default: () => null }));
vi.mock("@/components/settings/ThemeButton", () => ({ default: () => null }));
vi.mock("@/components/settings/VolumeSlider", () => ({ default: () => null }));

let roots: Root[];
let containers: HTMLDivElement[];
let App: typeof import("@/App").default;
let SettingsPage: typeof import("../SettingsPage").default;
let telemetryEnabledAtom: typeof import("@/state/atoms").telemetryEnabledAtom;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  roots = [];
  containers = [];
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
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
  // Fail closed if a test accidentally reaches a browser network boundary.
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(() => {
      throw new Error("Unexpected network request");
    }),
  );
  vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => {
    throw new Error("Unexpected XHR request");
  });
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  for (const container of containers) container.remove();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function load(stored?: boolean) {
  if (stored !== undefined) localStorage.setItem("telemetry-enabled", JSON.stringify(stored));
  ({ telemetryEnabledAtom } = await import("@/state/atoms"));
  ({ default: App } = await import("@/App"));
  ({ default: SettingsPage } = await import("../SettingsPage"));
}

async function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(node));
  return container;
}

async function settings() {
  const container = await render(
    <MantineProvider env="test">
      <SettingsPage />
    </MantineProvider>,
  );
  const privacyTab = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
    (tab) => tab.textContent === "Settings.Privacy",
  );
  expect(privacyTab).toBeDefined();
  await act(async () => privacyTab!.click());
  const panel = document.getElementById(privacyTab!.getAttribute("aria-controls")!);
  const toggle = panel?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  expect(toggle).toBeInstanceOf(HTMLInputElement);
  return toggle!;
}

function expectNoVendorCalls() {
  expect(mocks.init).not.toHaveBeenCalled();
  expect(mocks.capture).not.toHaveBeenCalled();
  expect(mocks.optIn).not.toHaveBeenCalled();
  expect(mocks.optOut).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(XMLHttpRequest.prototype.send).not.toHaveBeenCalled();
}

it.each([undefined, false, true])(
  "hydrates consent %s before startup without rewriting storage",
  async (stored) => {
    await load(stored);
    expect(getDefaultStore().get(telemetryEnabledAtom)).toBe(stored ?? false);
    expect(localStorage.getItem("telemetry-enabled")).toBe(
      stored === undefined ? null : JSON.stringify(stored),
    );
    expectNoVendorCalls();
  },
);

it.each([undefined, false])(
  "starts with consent %s without touching PostHog and retains local logging",
  async (stored) => {
    await load(stored);
    await render(<App />);
    expectNoVendorCalls();
    expect(mocks.getVersion).not.toHaveBeenCalled();
    expect(mocks.info).toHaveBeenCalledWith("React app started successfully");
    const toggle = await settings();
    expect(toggle.checked).toBe(false);
    expectNoVendorCalls();
  },
);

it("restores explicit consent at startup with the existing privacy flags and event fields", async () => {
  await load(true);
  await render(<App />);
  expect(mocks.init).toHaveBeenCalledExactlyOnceWith(expect.any(String), {
    api_host: "https://app.posthog.com",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
  });
  // Reconcile a previously persisted SDK opt-out with the explicit app preference.
  expect(mocks.optIn).toHaveBeenCalledWith({ captureEventName: false });
  expect(mocks.capture).toHaveBeenCalledExactlyOnceWith("app_started", { version: "test-version" });
  expect(localStorage.getItem("telemetry-enabled")).toBe("true");
});

it("can withdraw stored consent from settings before startup without initializing or touching the client", async () => {
  await load(true);
  const toggle = await settings();
  expect(toggle.checked).toBe(true);
  await act(async () => toggle.click());
  expect(toggle.checked).toBe(false);
  expect(localStorage.getItem("telemetry-enabled")).toBe("false");
  expectNoVendorCalls();
  await render(<App />);
  expectNoVendorCalls();
});

it("initializes from the settings switch before startup and shares that instance with repeated startups", async () => {
  await load(false);
  const toggle = await settings();
  expect(toggle.checked).toBe(false);
  expectNoVendorCalls();
  await act(async () => toggle.click());
  expect(toggle.checked).toBe(true);
  expect(getDefaultStore().get(telemetryEnabledAtom)).toBe(true);
  expect(localStorage.getItem("telemetry-enabled")).toBe("true");
  expect(mocks.init).toHaveBeenCalledTimes(1);
  expect(mocks.optIn).toHaveBeenCalledWith({ captureEventName: false });
  expect(mocks.capture).not.toHaveBeenCalled();
  await render(<App />);
  await render(<App />);
  expect(mocks.init).toHaveBeenCalledTimes(1);
  expect(mocks.capture).toHaveBeenCalledTimes(2);
});

it("enables, opts out, and resumes from the real switch without reinitializing or capturing app_started", async () => {
  await load(false);
  await render(<App />);
  const toggle = await settings();
  expectNoVendorCalls();
  await act(async () => toggle.click());
  expect(mocks.init).toHaveBeenCalledTimes(1);
  expect(mocks.optIn).toHaveBeenCalledTimes(1);
  expect(mocks.capture).not.toHaveBeenCalled();
  await act(async () => toggle.click());
  expect(toggle.checked).toBe(false);
  expect(getDefaultStore().get(telemetryEnabledAtom)).toBe(false);
  expect(localStorage.getItem("telemetry-enabled")).toBe("false");
  expect(mocks.optOut).toHaveBeenCalledTimes(1);
  await render(<App />);
  expect(mocks.init).toHaveBeenCalledTimes(1);
  expect(mocks.optIn).toHaveBeenCalledTimes(1);
  expect(mocks.capture).not.toHaveBeenCalled();
  await act(async () => toggle.click());
  expect(toggle.checked).toBe(true);
  expect(localStorage.getItem("telemetry-enabled")).toBe("true");
  expect(mocks.init).toHaveBeenCalledTimes(1);
  expect(mocks.optIn).toHaveBeenCalledTimes(2);
  expect(mocks.capture).not.toHaveBeenCalled();
});

it("does not attempt the startup capture if consent is withdrawn while version lookup is pending", async () => {
  await load(true);
  let finishVersion!: (version: string) => void;
  mocks.getVersion.mockReturnValueOnce(
    new Promise<string>((resolve) => {
      finishVersion = resolve;
    }),
  );
  await render(<App />);
  expect(mocks.getVersion).toHaveBeenCalledTimes(1);
  const toggle = await settings();
  expect(toggle.checked).toBe(true);
  await act(async () => toggle.click());
  expect(mocks.optOut).toHaveBeenCalledTimes(1);
  await act(async () => finishVersion("test-version"));
  expect(mocks.capture).not.toHaveBeenCalled();
});
