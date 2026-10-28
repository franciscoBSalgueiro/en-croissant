import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeEach, vi } from "vitest";
import en_US from "@/translation/en-US.json";
import { resetTauriMocks, setupTauriMocks } from "./tauri";

// Sounds go through the Rust sound server, tests don't need them
vi.mock("@/utils/sound", () => ({
    playSound: vi.fn<() => void>(),
}));

i18n.use(initReactI18next).init({
    resources: { "en-US": en_US },
    lng: "en-US",
    fallbackLng: "en-US",
    returnEmptyString: false,
    showSupportNotice: false,
});

// The Tauri OS plugin reads these at import time, e.g. for the default keybinds
Object.assign(window, {
    __TAURI_OS_PLUGIN_INTERNALS__: {
        platform: "linux",
        family: "unix",
        os_type: "linux",
        version: "",
        arch: "x86_64",
        eol: "\n",
        exe_extension: "",
    },
});

// Browser APIs that Mantine and the components use but jsdom doesn't implement
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
});

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;

Element.prototype.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
    setupTauriMocks();
});

afterEach(() => {
    cleanup();
    resetTauriMocks();
    localStorage.clear();
    sessionStorage.clear();
});
