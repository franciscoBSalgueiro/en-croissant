import { useMediaQuery, useViewportSize } from "@mantine/hooks";

/** True when built for iOS/Android (set by vite.config.ts from TAURI_ENV_PLATFORM). */
export const IS_MOBILE_APP: boolean = !!import.meta.env.VITE_MOBILE;

export type LayoutMode = "desktop" | "portrait" | "landscape";

/**
 * - desktop: classic sidebar + resizable windows
 * - portrait: bottom tab bar, board on top, panels below (iPhone/iPad upright)
 * - landscape: side rail, board left, panels right (iPhone/iPad sideways)
 */
export function useLayoutMode(): LayoutMode {
    const { width, height } = useViewportSize();
    const narrow = useMediaQuery("(max-width: 700px)", false, { getInitialValueInEffect: false });
    if (!IS_MOBILE_APP && !narrow) return "desktop";
    const w = width || window.innerWidth;
    const h = height || window.innerHeight;
    return w > h ? "landscape" : "portrait";
}

/** Any touch layout (portrait or landscape). */
export function useMobileLayout(): boolean {
    return useLayoutMode() !== "desktop";
}
