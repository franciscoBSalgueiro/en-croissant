// @vitest-environment jsdom
import { Provider } from "jotai";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/__root";

type CapturedMenuItem = { id?: string; action?: () => Promise<void> };
type CapturedSubmenu = { text: string; items: CapturedMenuItem[] };
const mocks = vi.hoisted(() => ({
  check: vi.fn<() => Promise<{ downloadAndInstall: () => Promise<void> } | null>>(),
  ask: vi.fn<typeof import("@tauri-apps/plugin-dialog").ask>(),
  message:
    vi.fn<
      (...args: Parameters<typeof import("@tauri-apps/plugin-dialog").message>) => Promise<void>
    >(),
  install: vi.fn<import("@tauri-apps/plugin-updater").Update["downloadAndInstall"]>(),
  relaunch: vi.fn<typeof import("@tauri-apps/plugin-process").relaunch>(),
  log: vi.fn<typeof import("@tauri-apps/plugin-log").error>(),
  notify: vi.fn<typeof import("@mantine/notifications").notifications.show>(),
  platform: vi.fn<typeof import("@tauri-apps/plugin-os").platform>(),
  menuItem: vi.fn<(options: CapturedMenuItem) => Promise<CapturedMenuItem>>(),
  submenu: vi.fn<(options: CapturedSubmenu) => Promise<CapturedSubmenu>>(),
  menu: vi.fn<
    (options?: { items: CapturedSubmenu[] }) => Promise<{ setAsAppMenu: () => Promise<void> }>
  >(),
  setAsAppMenu: vi.fn<() => Promise<void>>(),
  navigate: vi.fn<ReturnType<typeof import("@tanstack/react-router").useNavigate>>(),
  translation: vi.fn<() => ((key: string) => string) | undefined>(),
  window: {
    listen: vi.fn<import("@tauri-apps/api/window").Window["listen"]>(),
    setDecorations: vi.fn<import("@tauri-apps/api/window").Window["setDecorations"]>(),
    isFullscreen: vi.fn<import("@tauri-apps/api/window").Window["isFullscreen"]>(),
    setFullscreen: vi.fn<import("@tauri-apps/api/window").Window["setFullscreen"]>(),
  },
}));

vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: mocks.ask,
  message: mocks.message,
  open: vi.fn<typeof import("@tauri-apps/plugin-dialog").open>(),
}));
vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: mocks.relaunch,
  exit: vi.fn<typeof import("@tauri-apps/plugin-process").exit>(),
}));
vi.mock("@tauri-apps/plugin-log", () => ({ error: mocks.log }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: mocks.platform }));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn<typeof import("@tauri-apps/plugin-opener").openPath>(),
  openUrl: vi.fn<typeof import("@tauri-apps/plugin-opener").openUrl>(),
}));
vi.mock("@tauri-apps/api/path", () => ({
  appLogDir: vi.fn<typeof import("@tauri-apps/api/path").appLogDir>(),
  resolve: vi.fn<typeof import("@tauri-apps/api/path").resolve>(),
}));
vi.mock("@tauri-apps/api/event", () => ({ TauriEvent: { DRAG_DROP: "tauri://drag-drop" } }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => mocks.window }));
vi.mock("@tauri-apps/api/menu", () => ({
  MenuItem: { new: mocks.menuItem },
  Submenu: { new: mocks.submenu },
  Menu: { new: mocks.menu },
  PredefinedMenuItem: {
    new: vi.fn<
      (
        ...args: Parameters<(typeof import("@tauri-apps/api/menu").PredefinedMenuItem)["new"]>
      ) => Promise<CapturedMenuItem>
    >(async () => ({})),
  },
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("@mantine/core", () => {
  const Container = ({ children }: { children: ReactNode }) => <>{children}</>;
  return {
    AppShell: Object.assign(Container, { Header: Container, Navbar: Container, Main: Container }),
  };
});
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
  Outlet: () => null,
}));
vi.mock("@/components/About", () => ({ default: () => null }));
vi.mock("@/components/Sidebar", () => ({ SideBar: () => null }));
vi.mock("@/components/TopBar", () => ({ default: () => null }));
vi.mock("@/utils/files", () => ({ openFile: vi.fn<typeof import("@/utils/files").openFile>() }));
vi.mock("@/utils/tabs", () => ({ createTab: vi.fn<typeof import("@/utils/tabs").createTab>() }));
vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: vi.fn<typeof import("react-hotkeys-hook").useHotkeys>(),
}));
vi.mock("react-i18next", () => {
  // Keep t stable so menu callbacks do not generate a new SWR key on every render.
  const t = (key: string) => key;
  return { useTranslation: () => ({ t: mocks.translation() ?? t }) };
});
vi.mock("@/state/atoms", async () => {
  const { atom } = await import("jotai");
  return {
    nativeBarAtom: atom(true),
    activeTabAtom: atom(null),
    tabsAtom: atom([]),
    showSidebarAtom: atom(true),
    showTabBarAtom: atom(true),
  };
});
vi.mock("@/state/keybinds", async () => {
  const { atom } = await import("jotai");
  return {
    keyMapAtom: atom({
      NEW_TAB: { keys: "mod+t" },
      OPEN_FILE: { keys: "mod+o" },
      TOGGLE_SIDEBAR: { keys: "mod+b" },
      TOGGLE_TAB_BAR: { keys: "mod+shift+b" },
    }),
  };
});

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.check.mockResolvedValue(null);
  mocks.ask.mockResolvedValue(true);
  mocks.message.mockResolvedValue(undefined);
  mocks.install.mockResolvedValue(undefined);
  mocks.relaunch.mockResolvedValue(undefined);
  mocks.log.mockResolvedValue(undefined);
  mocks.menuItem.mockImplementation(async (options) => options);
  mocks.submenu.mockImplementation(async (options) => options);
  mocks.menu.mockResolvedValue({ setAsAppMenu: mocks.setAsAppMenu });
  mocks.setAsAppMenu.mockResolvedValue(undefined);
  mocks.window.listen.mockResolvedValue(vi.fn<import("@tauri-apps/api/event").UnlistenFn>());
  mocks.window.setDecorations.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderUpdateAction(
  platform: ReturnType<typeof import("@tauri-apps/plugin-os").platform>,
) {
  mocks.platform.mockReturnValue(platform);
  const RootLayout = Route.options.component!;
  await act(async () => {
    root.render(
      <Provider>
        <SWRConfig value={{ provider: () => new Map() }}>
          <RootLayout />
        </SWRConfig>
      </Provider>,
    );
  });
  const items = mocks.menuItem.mock.calls
    .map(([options]) => options)
    .filter((options) => options.id === "check_for_updates");
  expect(items).toHaveLength(1);
  expect(mocks.submenu).toHaveBeenCalledWith({
    text: platform === "macos" ? "Application Menu" : "Menu.Help",
    items: expect.arrayContaining([items[0]]),
  });
  expect(mocks.setAsAppMenu).toHaveBeenCalledTimes(1);
  expect(mocks.check).not.toHaveBeenCalled();
  expect(items[0].action).toBeTypeOf("function");
  return items[0].action!;
}

function expectError(message: string) {
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
    title: "Common.Error",
    message,
    color: "red",
  });
}

describe.each(["macos", "linux"] as const)("manual updater via %s menu", (platform) => {
  it.each(["check", "ask", "install", "relaunch", "message"] as const)(
    "ignores duplicate actions while %s is pending",
    async (stage) => {
      const blocked = Promise.withResolvers<void>();
      const update = { downloadAndInstall: mocks.install };
      mocks.check.mockResolvedValue(stage === "message" ? null : update);
      if (stage === "check") {
        mocks.check.mockReturnValueOnce(blocked.promise.then(() => update));
      } else if (stage === "ask") {
        mocks.ask.mockReturnValueOnce(blocked.promise.then(() => true));
      } else {
        mocks[stage].mockReturnValueOnce(blocked.promise);
      }
      const action = await renderUpdateAction(platform);
      const pending = action();
      const duplicates: Promise<void>[] = [];
      try {
        // Do not yield for check: duplicate menu actions can arrive in the same tick.
        if (stage !== "check") {
          await vi.waitUntil(() => mocks[stage].mock.calls.length === 1);
        }
        duplicates.push(action(), action());
        expect(mocks.check).toHaveBeenCalledTimes(1);
        await expect(Promise.all(duplicates)).resolves.toEqual([undefined, undefined]);
        expect(mocks.ask).toHaveBeenCalledTimes(stage === "check" || stage === "message" ? 0 : 1);
        expect(mocks.install).toHaveBeenCalledTimes(
          stage === "install" || stage === "relaunch" ? 1 : 0,
        );
        expect(mocks.relaunch).toHaveBeenCalledTimes(stage === "relaunch" ? 1 : 0);
        expect(mocks.message).toHaveBeenCalledTimes(stage === "message" ? 1 : 0);
      } finally {
        blocked.resolve();
        await Promise.all([pending, ...duplicates]);
      }
      // Ignored actions must not queue another workflow after the first finishes.
      expect(mocks.check).toHaveBeenCalledTimes(1);
      expect(mocks.ask).toHaveBeenCalledTimes(stage === "message" ? 0 : 1);
      expect(mocks.install).toHaveBeenCalledTimes(stage === "message" ? 0 : 1);
      expect(mocks.relaunch).toHaveBeenCalledTimes(stage === "message" ? 0 : 1);
      expect(mocks.message).toHaveBeenCalledTimes(stage === "message" ? 1 : 0);
      expect(mocks.notify).not.toHaveBeenCalled();
    },
  );

  it("shares the guard with a fresh menu callback after a translation rerender", async () => {
    const installation = Promise.withResolvers<void>();
    mocks.check.mockResolvedValue({ downloadAndInstall: mocks.install });
    mocks.install.mockReturnValueOnce(installation.promise);
    const action = await renderUpdateAction(platform);
    const pending = action();
    try {
      await vi.waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
      mocks.translation.mockReturnValue((key: string) => key);
      const RootLayout = Route.options.component!;
      await act(async () => {
        root.render(
          <Provider>
            <SWRConfig value={{ provider: () => new Map() }}>
              <RootLayout />
            </SWRConfig>
          </Provider>,
        );
      });
      const items = mocks.menuItem.mock.calls
        .map(([options]) => options)
        .filter((options) => options.id === "check_for_updates");
      expect(items).toHaveLength(2);
      const freshAction = items[1].action!;
      expect(freshAction).not.toBe(action);
      await expect(freshAction()).resolves.toBeUndefined();
      expect(mocks.check).toHaveBeenCalledTimes(1);
      expect(mocks.ask).toHaveBeenCalledTimes(1);
      expect(mocks.install).toHaveBeenCalledTimes(1);
      expect(mocks.relaunch).not.toHaveBeenCalled();
      installation.resolve();
      await pending;
      await expect(freshAction()).resolves.toBeUndefined();
      expect(mocks.check).toHaveBeenCalledTimes(2);
      expect(mocks.ask).toHaveBeenCalledTimes(2);
      expect(mocks.install).toHaveBeenCalledTimes(2);
      expect(mocks.relaunch).toHaveBeenCalledTimes(2);
      expect(mocks.notify).not.toHaveBeenCalled();
    } finally {
      installation.resolve();
      await pending;
    }
  });

  it.each([new Error("Update server unavailable"), "Update server unavailable"])(
    "contains check rejection %s and permits the same action to retry",
    async (cause) => {
      mocks.check.mockRejectedValueOnce(cause);
      const action = await renderUpdateAction(platform);
      await expect(action()).resolves.toBeUndefined();
      expectError("Update server unavailable");
      expect(mocks.ask).not.toHaveBeenCalled();
      expect(mocks.install).not.toHaveBeenCalled();
      expect(mocks.relaunch).not.toHaveBeenCalled();
      expect(mocks.message).not.toHaveBeenCalled();

      mocks.check.mockResolvedValueOnce({ downloadAndInstall: mocks.install });
      await expect(action()).resolves.toBeUndefined();
      expect(mocks.check).toHaveBeenCalledTimes(2);
      expect(mocks.install).toHaveBeenCalledTimes(1);
      expect(mocks.relaunch).toHaveBeenCalledTimes(1);
      expect(mocks.notify).toHaveBeenCalledTimes(1);
      expect(mocks.message).not.toHaveBeenCalled();
    },
  );

  it("preserves the exact no-update message and permits another check", async () => {
    const action = await renderUpdateAction(platform);
    await expect(action()).resolves.toBeUndefined();
    expect(mocks.message).toHaveBeenCalledExactlyOnceWith("No updates available");
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
    await expect(action()).resolves.toBeUndefined();
    expect(mocks.check).toHaveBeenCalledTimes(2);
    expect(mocks.message).toHaveBeenCalledTimes(2);
  });

  it("preserves the install prompt and permits retry after declining", async () => {
    mocks.check.mockResolvedValue({ downloadAndInstall: mocks.install });
    mocks.ask.mockResolvedValue(false);
    const action = await renderUpdateAction(platform);
    await expect(action()).resolves.toBeUndefined();
    expect(mocks.ask).toHaveBeenCalledExactlyOnceWith(
      "Do you want to install the new version now?",
      { title: "New version available" },
    );
    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(mocks.message).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
    mocks.ask.mockResolvedValueOnce(true);
    await expect(action()).resolves.toBeUndefined();
    expect(mocks.check).toHaveBeenCalledTimes(2);
    expect(mocks.ask).toHaveBeenCalledTimes(2);
    expect(mocks.install).toHaveBeenCalledTimes(1);
    expect(mocks.relaunch).toHaveBeenCalledTimes(1);
  });

  it("awaits installation before relaunch and awaits relaunch before resolving", async () => {
    const installation = Promise.withResolvers<void>();
    const restart = Promise.withResolvers<void>();
    mocks.check.mockResolvedValue({ downloadAndInstall: mocks.install });
    mocks.install.mockReturnValue(installation.promise);
    mocks.relaunch.mockReturnValue(restart.promise);
    const action = await renderUpdateAction(platform);
    let settled = false;
    const pending = action().then(() => {
      settled = true;
    });
    await vi.waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(settled).toBe(false);
    installation.resolve();
    await vi.waitFor(() => expect(mocks.relaunch).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);
    restart.resolve();
    await pending;
    expect(settled).toBe(true);
    expect(mocks.message).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
    await expect(action()).resolves.toBeUndefined();
    expect(mocks.check).toHaveBeenCalledTimes(2);
    expect(mocks.install).toHaveBeenCalledTimes(2);
    expect(mocks.relaunch).toHaveBeenCalledTimes(2);
  });

  it.each(["ask", "install", "relaunch", "message"] as const)(
    "contains %s failure without continuing the flow and permits retry",
    async (failure) => {
      if (failure !== "message") {
        mocks.check.mockResolvedValue({ downloadAndInstall: mocks.install });
      }
      mocks[failure].mockRejectedValueOnce(new Error(`${failure} failed`));
      const action = await renderUpdateAction(platform);
      await expect(action()).resolves.toBeUndefined();
      expectError(`${failure} failed`);
      expect(mocks.ask).toHaveBeenCalledTimes(failure === "message" ? 0 : 1);
      expect(mocks.install).toHaveBeenCalledTimes(
        failure === "install" || failure === "relaunch" ? 1 : 0,
      );
      expect(mocks.relaunch).toHaveBeenCalledTimes(failure === "relaunch" ? 1 : 0);
      expect(mocks.message).toHaveBeenCalledTimes(failure === "message" ? 1 : 0);
      mocks.check.mockResolvedValueOnce({ downloadAndInstall: mocks.install });
      await expect(action()).resolves.toBeUndefined();
      expect(mocks.check).toHaveBeenCalledTimes(2);
      expect(mocks.ask).toHaveBeenCalledTimes(failure === "message" ? 1 : 2);
      expect(mocks.install).toHaveBeenCalledTimes(
        failure === "install" || failure === "relaunch" ? 2 : 1,
      );
      expect(mocks.relaunch).toHaveBeenCalledTimes(failure === "relaunch" ? 2 : 1);
      expect(mocks.notify).toHaveBeenCalledTimes(1);
    },
  );

  it("does not let rejected logging escape or prevent the notification", async () => {
    const logFailure = new Error("Log unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.check.mockRejectedValueOnce(new Error("Check failed"));
    mocks.log.mockRejectedValueOnce(logFailure);
    const action = await renderUpdateAction(platform);
    await expect(action()).resolves.toBeUndefined();
    expectError("Check failed");
    expect(mocks.log).toHaveBeenCalledExactlyOnceWith("Check failed");
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(logFailure);
  });

  it("does not wait for logging before notifying and resolving", async () => {
    const logging = Promise.withResolvers<void>();
    mocks.check.mockRejectedValueOnce("Check failed");
    mocks.log.mockReturnValueOnce(logging.promise);
    const action = await renderUpdateAction(platform);
    try {
      await expect(action()).resolves.toBeUndefined();
      expectError("Check failed");
      expect(mocks.log).toHaveBeenCalledExactlyOnceWith("Check failed");
    } finally {
      logging.resolve();
    }
  });
});
