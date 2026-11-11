import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import type { InvokeArgs } from "@tauri-apps/api/core";

type Handler = (args: InvokeArgs | undefined) => unknown;

const handlers = new Map<string, Handler>();

/**
 * Answers a Tauri command (by its Rust name, e.g. `get_opening_from_fens`) in the current test.
 * Commands without a handler resolve to `null`.
 */
export function mockCommand(cmd: string, handler: Handler) {
    handlers.set(cmd, handler);
}

export function setupTauriMocks() {
    mockIPC((cmd, args) => handlers.get(cmd)?.(args) ?? null);
}

export function resetTauriMocks() {
    handlers.clear();
    clearMocks();
}
