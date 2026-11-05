import { useMediaQuery } from "@mantine/hooks";

/** True when built for iOS/Android (set by vite.config.ts from TAURI_ENV_PLATFORM). */
export const IS_MOBILE_APP: boolean = !!import.meta.env.VITE_MOBILE;

/** Phone-style layout: always in the mobile app, or on narrow windows. */
export function useMobileLayout(): boolean {
    const narrow = useMediaQuery("(max-width: 700px)", false, { getInitialValueInEffect: false });
    return IS_MOBILE_APP || !!narrow;
}
