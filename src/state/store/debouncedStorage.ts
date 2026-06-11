import { compressToUTF16, decompressFromUTF16 } from "lz-string";
import { type PersistStorage, type StorageValue } from "zustand/middleware";

// Tree state is persisted compressed. A ~6,600-node game serializes to ~1.5MB of JSON, which
// fills the ~5MB sessionStorage quota after a couple of tabs. compressToUTF16 shrinks it ~5x
// with an exact (lossless) round-trip and stays synchronous (no async hydration / flash). The
// seed writes in createTab / ImportModal use these same helpers so the store reads them back.
export function serializeStorageValue(value: unknown): string {
    return compressToUTF16(JSON.stringify(value));
}

export function deserializeStorageValue<T>(stored: string): T | null {
    try {
        const json = decompressFromUTF16(stored);
        return json ? (JSON.parse(json) as T) : null;
    } catch {
        return null;
    }
}

const DEBOUNCE_MS = 300;
const pendingWrites = new Map<string, StorageValue<unknown>>();

let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let flushHandlersBound = false;

function flush() {
    if (pendingWrites.size === 0) {
        return;
    }

    for (const [name, value] of pendingWrites) {
        sessionStorage.setItem(name, serializeStorageValue(value));
    }

    pendingWrites.clear();
}

function scheduleFlush(delay: number) {
    if (flushTimeout) {
        clearTimeout(flushTimeout);
    }

    flushTimeout = setTimeout(() => {
        flushTimeout = null;
        flush();
    }, delay);
}

function bindFlushHandlers() {
    if (flushHandlersBound || typeof window === "undefined") {
        return;
    }

    const flushAndClearTimeout = () => {
        if (flushTimeout) {
            clearTimeout(flushTimeout);
            flushTimeout = null;
        }

        flush();
    };

    window.addEventListener("beforeunload", flushAndClearTimeout);
    window.addEventListener("pagehide", flushAndClearTimeout);

    flushHandlersBound = true;
}

export function createDebouncedSessionStorage<S>(delay = DEBOUNCE_MS): PersistStorage<S> {
    bindFlushHandlers();

    return {
        getItem: (name) => {
            const pending = pendingWrites.get(name);
            if (pending) {
                return pending as StorageValue<S>;
            }

            const stored = sessionStorage.getItem(name);
            return stored ? deserializeStorageValue<StorageValue<S>>(stored) : null;
        },
        setItem: (name, value) => {
            pendingWrites.set(name, value as StorageValue<unknown>);
            scheduleFlush(delay);
        },
        removeItem: (name) => {
            pendingWrites.delete(name);
            sessionStorage.removeItem(name);
        },
    };
}
