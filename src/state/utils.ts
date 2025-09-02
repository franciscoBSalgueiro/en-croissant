import {
  BaseDirectory,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type {
  AsyncStorage,
  AsyncStringStorage,
  SyncStorage,
  SyncStringStorage,
} from "jotai/vanilla/utils/atomWithStorage";

import { appDataDir, resolve } from "@tauri-apps/api/path";
// Web-first: replace tauri log calls with safe console fallbacks
const info = async (...args: any[]) => {
  try { /* eslint-disable no-console */ console.info(...args); } catch {}
};
const warn = (...args: any[]) => {
  try { /* eslint-disable no-console */ console.warn(...args); } catch {}
};
import type { z } from "zod";

const options = { baseDir: BaseDirectory.AppData };

async function resolveAppDataPath(key: string): Promise<string> {
  const dir = await appDataDir();
  return await resolve(dir, key);
}

function normalizeToString(input: any): string | null {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    try {
      if (typeof (input as any).byteLength === "number") {
        return new TextDecoder().decode(input as ArrayBufferView as any);
      }
    } catch {}
  }
  return input == null ? null : String(input);
}

export const fileStorage: AsyncStringStorage = {
  async getItem(key) {
    try {
      const abs = await resolveAppDataPath(key);
      const raw: any = await readTextFile(abs as any);
      const value = normalizeToString(raw);
      await info(
        `fileStorage.getItem: key=${key} abs=${abs} (${value?.length ?? 0} bytes)`,
      );
      if (!value || value.length === 0) {
        return null;
      }
      return value;
    } catch (error) {
      await info(`fileStorage.getItem: key=${key} not found`);
      return null;
    }
  },
  async setItem(key, newValue) {
    const abs = await resolveAppDataPath(key);
    await writeTextFile(abs as any, newValue);
    await info(
      `fileStorage.setItem: key=${key} abs=${abs} (${newValue?.length ?? 0} bytes)`,
    );
  },
  async removeItem(key) {
    const abs = await resolveAppDataPath(key);
    await remove(abs as any);
    await info(`fileStorage.removeItem: key=${key} abs=${abs}`);
  },
};

export function createZodStorage<Value>(
  schema: z.ZodType<Value>,
  storage: SyncStringStorage,
): SyncStorage<Value> {
  return {
    getItem(key, initialValue) {
      const storedValue = storage.getItem(key);
      if (storedValue === null) {
        return initialValue;
      }
      try {
        return schema.parse(JSON.parse(storedValue));
      } catch {
        warn(`Invalid value for ${key}: ${storedValue}`);
        this.setItem(key, initialValue);
        return initialValue;
      }
    },
    setItem(key, value) {
      storage.setItem(key, JSON.stringify(value));
    },
    removeItem(key) {
      storage.removeItem(key);
    },
  };
}

export function createAsyncZodStorage<Value>(
  schema: z.ZodType<Value>,
  storage: AsyncStringStorage,
): AsyncStorage<Value> {
  return {
    async getItem(key, initialValue) {
      try {
        const storedValueAny: any = await storage.getItem(key);
        const storedValue = normalizeToString(storedValueAny);
        if (storedValue === null) {
          await info(`asyncStorage.getItem: key=${key} -> initialValue`);
          return initialValue;
        }
        if (storedValue.trim().length === 0) {
          warn(`Empty value for ${key}`);
          return initialValue;
        }
        const res = schema.safeParse(JSON.parse(storedValue));
        if (res.success) {
          const v: any = res.data as any;
          const summary = Array.isArray(v)
            ? `array(len=${v.length})`
            : typeof v === "object"
              ? "object"
              : typeof v;
          await info(`asyncStorage.getItem: key=${key} -> ${summary}`);
          return res.data;
        }
        warn(`Invalid value for ${key}: ${storedValue}\n${res.error}`);
        return initialValue;
      } catch (error) {
        warn(`Error getting ${key}: ${error}`);
        return initialValue;
      }
    },
    async setItem(key, value) {
      await storage.setItem(key, JSON.stringify(value, null, 4));
      try {
        const v: any = value as any;
        const summary = Array.isArray(v)
          ? `array(len=${v.length})`
          : typeof v === "object"
            ? "object"
            : typeof v;
        await info(`asyncStorage.setItem: key=${key} <- ${summary}`);
      } catch {}
    },
    async removeItem(key) {
      await storage.removeItem(key);
      await info(`asyncStorage.removeItem: key=${key}`);
    },
  };
}

// DataStore (IndexedDB) async storage backend
async function loadDataStoreGlobal(): Promise<any> {
  if (typeof window === "undefined") return null;
  const g: any = window as any;
  if (g.DataStore) return g.DataStore;
  // Load global UMD build from CDN
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@blakewatson/datastore/dist/datastore.global.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load DataStore"));
    document.head.appendChild(script);
  });
  return (window as any).DataStore || null;
}

let dataStoreSingleton: Promise<any> | null = null;
async function getDataStoreInstance() {
  if (dataStoreSingleton) return dataStoreSingleton;
  dataStoreSingleton = (async () => {
    const DS: any = await loadDataStoreGlobal();
    if (!DS) throw new Error("DataStore not available");
    // UMD may export the class directly, or as .default or .DataStore
    const Ctor = (DS && (DS.DataStore || DS.default || DS));
    if (typeof Ctor !== "function") throw new Error("Invalid DataStore export");
    // Single database with a single KV store
    const store = new Ctor("Botvinnik", "app");
    return store;
  })();
  return dataStoreSingleton;
}

export const dataStoreStorage: AsyncStringStorage = {
  async getItem(key) {
    try {
      const store = await getDataStoreInstance();
      const value = await store.getItem(key);
      if (value === undefined || value === null) return null;
      return typeof value === "string" ? value : JSON.stringify(value);
    } catch {
      return null;
    }
  },
  async setItem(key, newValue) {
    const store = await getDataStoreInstance();
    await store.setItem(key, newValue);
  },
  async removeItem(key) {
    const store = await getDataStoreInstance();
    await store.removeItem(key);
  },
};

// Async wrapper around localStorage for web fallback
export const localAsyncStorage: AsyncStringStorage = {
  async getItem(key) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? null : v;
    } catch {
      return null;
    }
  },
  async setItem(key, newValue) {
    try { localStorage.setItem(key, newValue); } catch {}
  },
  async removeItem(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};

// Hybrid storage: try DataStore (IndexedDB) first; fall back to localStorage transparently.
export const hybridDataStoreStorage: AsyncStringStorage = {
  async getItem(key) {
    // Prefer DataStore; if unavailable/empty, fall back to localStorage
    const ds = await dataStoreStorage.getItem(key);
    if (ds !== null && typeof ds === 'string' && ds.length > 0) return ds;
    return await localAsyncStorage.getItem(key);
  },
  async setItem(key, newValue) {
    // Best-effort write to both backends
    try { await dataStoreStorage.setItem(key, newValue); } catch {}
    try { await localAsyncStorage.setItem(key, newValue); } catch {}
  },
  async removeItem(key) {
    try { await dataStoreStorage.removeItem(key); } catch {}
    try { await localAsyncStorage.removeItem(key); } catch {}
  },
};
