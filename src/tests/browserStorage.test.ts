import { afterEach, expect, it, vi } from "vitest";

const key = "browser-storage-regression";

afterEach(() => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
});

it.each(["localStorage", "sessionStorage"] as const)(
    "%s uses jsdom storage rather than Node's native storage",
    (name) => {
        expect(globalThis[name]).toBe(window[name]);
        expect(globalThis[name]).toBeInstanceOf(window.Storage);
        globalThis[name].setItem(key, "saved");
        expect(window[name].getItem(key)).toBe("saved");
        globalThis[name].removeItem(key);
        expect(window[name].getItem(key)).toBeNull();

        const storage = globalThis[name];
        vi.stubGlobal(name, undefined);
        vi.unstubAllGlobals();
        expect(globalThis[name]).toBe(storage);
        expect(globalThis[name]).toBeInstanceOf(window.Storage);
    },
);
