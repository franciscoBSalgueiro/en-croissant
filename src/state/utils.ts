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

import { warn } from "@tauri-apps/plugin-log";
import type { z } from "zod";
import { info } from "@tauri-apps/plugin-log";
import { appDataDir, resolve } from "@tauri-apps/api/path";

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
