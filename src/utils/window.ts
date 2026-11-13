import { getCurrentWindow } from "@tauri-apps/api/window";
import { error } from "@tauri-apps/plugin-log";
import { restoreStateCurrent, StateFlags } from "@tauri-apps/plugin-window-state";
import { commands } from "@/bindings";

export function usesNativeTitleBar(preferNative: boolean) {
    return (
        preferNative ||
        (import.meta.env.VITE_PLATFORM !== "win32" && import.meta.env.VITE_PLATFORM !== "linux")
    );
}

export async function showAppWindow(preferNative: boolean) {
    // Changing decorations after restoring geometry can move or resize the window.
    // Apply the preference first, and keep the window hidden until restoration ends.
    try {
        await getCurrentWindow().setDecorations(usesNativeTitleBar(preferNative));
    } catch (cause) {
        void error(`Failed to configure window decorations: ${cause}`).catch(console.error);
    }
    try {
        await restoreStateCurrent(
            StateFlags.SIZE | StateFlags.POSITION | StateFlags.MAXIMIZED | StateFlags.FULLSCREEN,
        );
    } catch (cause) {
        void error(`Failed to restore window state: ${cause}`).catch(console.error);
    }
    await commands.closeSplashscreen();
}
