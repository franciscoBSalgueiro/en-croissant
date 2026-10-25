import { type PersistStorage, type StorageValue } from "zustand/middleware";

const DEBOUNCE_MS = 300;
const pendingWrites = new Map<string, StorageValue<unknown>>();

let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let flushHandlersBound = false;

export function flushPendingSessionStorage() {
    if (pendingWrites.size === 0) {
        return;
    }

    for (const [name, value] of pendingWrites) {
        sessionStorage.setItem(name, JSON.stringify(value));
    }

    pendingWrites.clear();
}

function scheduleFlush(delay: number) {
    if (flushTimeout) {
        clearTimeout(flushTimeout);
    }

    flushTimeout = setTimeout(() => {
        flushTimeout = null;
        flushPendingSessionStorage();
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

        flushPendingSessionStorage();
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
                // Match persisted JSON: never hydrate another store's bound action functions.
                return JSON.parse(JSON.stringify(pending)) as StorageValue<S>;
            }

            const stored = sessionStorage.getItem(name);
            return stored ? (JSON.parse(stored) as StorageValue<S>) : null;
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
