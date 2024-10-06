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

const options = { baseDir: BaseDirectory.AppData };
export const fileStorage: AsyncStringStorage = {
  async getItem(key) {
    try {
      return await readTextFile(key, options);
    } catch (error) {
      return null;
    }
  },
  async setItem(key, newValue) {
    await writeTextFile(key, newValue, options);
  },
  async removeItem(key) {
    await remove(key, options);
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
        const storedValue = await storage.getItem(key);
        if (storedValue === null) {
          return initialValue;
        }
        const res = schema.safeParse(JSON.parse(storedValue));
        if (res.success) {
          return res.data;
        }
        warn(`Invalid value for ${key}: ${storedValue}\n${res.error}`);
        await this.setItem(key, initialValue);
        return initialValue;
      } catch (error) {
        warn(`Error getting ${key}: ${error}`);
        return initialValue;
      }
    },
    async setItem(key, value) {
      storage.setItem(key, JSON.stringify(value, null, 4));
    },
    async removeItem(key) {
      storage.removeItem(key);
    },
  };
}
