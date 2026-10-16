// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import ProgressButton from "./ProgressButton";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  clear: vi.fn<() => void>(),
  notify: vi.fn<() => void>(),
  progress: {
    progress: 25,
    finished: false,
    isActive: true,
    bytesPerSecond: 1048576 as number | null,
  },
}));
vi.mock("@/bindings", () => ({ commands: { cancelDownload: mocks.invoke } }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/useProgress", () => ({
  useProgress: () => ({
    ...mocks.progress,
    clear: mocks.clear,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.progress, {
    progress: 25,
    finished: false,
    isActive: true,
    bytesPerSecond: 1048576,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    }),
  });
});

it("cancels the backend transfer without allowing a retry before it settles", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const setInProgress = vi.fn<() => void>();
  await act(async () =>
    root.render(
      createElement(
        MantineProvider,
        {},
        createElement(ProgressButton, {
          id: "engine_1",
          cancellableDownload: true,
          initInstalled: false,
          onClick: vi.fn<() => void>(),
          inProgress: true,
          setInProgress,
          labels: { completed: "Installed", action: "Download", inProgress: "Downloading" },
        }),
      ),
    ),
  );
  expect(host.textContent).toContain("Downloading · 1 MB/s");
  mocks.progress.bytesPerSecond = 0;
  await act(async () =>
    root.render(
      createElement(
        MantineProvider,
        {},
        createElement(ProgressButton, {
          id: "engine_1",
          cancellableDownload: true,
          initInstalled: false,
          onClick: vi.fn<() => void>(),
          inProgress: true,
          setInProgress,
          labels: {
            completed: "Installed",
            action: "Download",
            inProgress: "Downloading",
            finalizing: "Extracting",
          },
        }),
      ),
    ),
  );
  expect(host.textContent).toContain("Downloading · 0 KB/s");
  const cancel = host.querySelector<HTMLButtonElement>('[aria-label="Common.Cancel"]');
  expect(cancel).not.toBeNull();
  await act(async () => cancel!.click());
  expect(mocks.invoke).toHaveBeenCalledWith("engine_1");
  expect(mocks.clear).not.toHaveBeenCalled();
  expect(setInProgress).not.toHaveBeenCalled();
  mocks.progress.progress = 100;
  await act(async () =>
    root.render(
      createElement(
        MantineProvider,
        {},
        createElement(ProgressButton, {
          id: "engine_1",
          cancellableDownload: true,
          initInstalled: false,
          onClick: vi.fn<() => void>(),
          inProgress: true,
          setInProgress,
          labels: {
            completed: "Installed",
            action: "Download",
            inProgress: "Downloading",
            finalizing: "Extracting",
          },
        }),
      ),
    ),
  );
  expect(host.textContent).toContain("Extracting");
  expect(host.textContent).not.toContain("KB/s");
  await act(async () => root.unmount());
  host.remove();
});

it.each([
  { message: "Download cancelled", notifies: false },
  { message: "Network failed", notifies: true },
])("resets a download after $message", async ({ message, notifies }) => {
  Object.assign(mocks.progress, { progress: 0, isActive: false, bytesPerSecond: null });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const setInProgress = vi.fn<(value: boolean) => void>();
  const onClick = vi.fn<() => Promise<void>>().mockRejectedValue(new Error(message));
  await act(async () =>
    root.render(
      createElement(
        MantineProvider,
        {},
        createElement(ProgressButton, {
          id: "db_1",
          cancellableDownload: true,
          initInstalled: false,
          onClick,
          inProgress: false,
          setInProgress,
          labels: { completed: "Installed", action: "Download", inProgress: "Downloading" },
        }),
      ),
    ),
  );
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(mocks.clear).toHaveBeenCalledOnce();
  expect(setInProgress).toHaveBeenCalledWith(false);
  expect(mocks.notify).toHaveBeenCalledTimes(notifies ? 1 : 0);
  await act(async () => root.unmount());
  host.remove();
});
