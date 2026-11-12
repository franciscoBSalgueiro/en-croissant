import { beforeEach, expect, test, vi } from "vitest";
import { StateFlags } from "@tauri-apps/plugin-window-state";
import { showAppWindow } from "../window";

const mocks = vi.hoisted(() => ({
    setDecorations: vi.fn<(decorated: boolean) => Promise<void>>(),
    restore: vi.fn<(flags: StateFlags) => Promise<void>>(),
    show: vi.fn<() => Promise<void>>(),
    error: vi.fn<(message: string) => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
    getCurrentWindow: () => ({ setDecorations: mocks.setDecorations }),
}));
vi.mock("@tauri-apps/plugin-window-state", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@tauri-apps/plugin-window-state")>()),
    restoreStateCurrent: mocks.restore,
}));
vi.mock("@tauri-apps/plugin-log", () => ({ error: mocks.error }));
vi.mock("@/bindings", () => ({ commands: { closeSplashscreen: mocks.show } }));

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_PLATFORM", "linux");
    mocks.setDecorations.mockResolvedValue(undefined);
    mocks.restore.mockResolvedValue(undefined);
});

test("waits for decorations and restored geometry before showing the window", async () => {
    const decorations = Promise.withResolvers<void>();
    const geometry = Promise.withResolvers<void>();
    mocks.setDecorations.mockReturnValue(decorations.promise);
    mocks.restore.mockReturnValue(geometry.promise);

    const startup = showAppWindow(false);
    expect(mocks.setDecorations).toHaveBeenCalledWith(false);
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(mocks.show).not.toHaveBeenCalled();

    decorations.resolve();
    await vi.waitFor(() => expect(mocks.restore).toHaveBeenCalled());
    expect(mocks.restore).toHaveBeenCalledWith(
        StateFlags.SIZE | StateFlags.POSITION | StateFlags.MAXIMIZED | StateFlags.FULLSCREEN,
    );
    expect(mocks.show).not.toHaveBeenCalled();

    geometry.resolve();
    await startup;
    expect(mocks.show).toHaveBeenCalledOnce();
});

test("shows the window even when restoration fails", async () => {
    mocks.restore.mockRejectedValueOnce(new Error("invalid saved geometry"));
    await showAppWindow(true);
    expect(mocks.setDecorations).toHaveBeenCalledWith(true);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("invalid saved geometry"));
    expect(mocks.show).toHaveBeenCalledOnce();
});

test("still restores geometry and shows the window when decoration setup fails", async () => {
    mocks.setDecorations.mockRejectedValueOnce(new Error("decorations unavailable"));
    await showAppWindow(false);
    expect(mocks.restore).toHaveBeenCalledOnce();
    expect(mocks.show).toHaveBeenCalledOnce();
});

test("uses native decorations on macOS even when the stored preference is custom", async () => {
    vi.stubEnv("VITE_PLATFORM", "darwin");
    await showAppWindow(false);
    expect(mocks.setDecorations).toHaveBeenCalledWith(true);
});
