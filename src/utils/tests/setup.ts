import { vi } from "vitest";

// Mock sound module to prevent its import of atoms.ts, which calls
// localStorage.getItem() synchronously via atomWithStorage({ getOnInit: true })
// during module initialization — before jsdom fully sets up localStorage.
vi.mock("@/utils/sound", () => ({
    playSound: vi.fn(),
}));
