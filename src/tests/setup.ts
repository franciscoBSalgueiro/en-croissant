/// <reference types="vitest/jsdom" />

// Vitest preserves Node globals. Use jsdom storage as the environment baseline,
// not a mock that vi.unstubAllGlobals() would restore to Node's native storage.
for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value: jsdom.window[name],
    });
}
