import {
  BaseDirectory,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { warn } from "@tauri-apps/plugin-log";
import equal from "fast-deep-equal";
import type {
  AsyncStorage,
  AsyncStringStorage,
  SyncStorage,
  SyncStringStorage,
} from "jotai/vanilla/utils/atomWithStorage";
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
        const rawValue = JSON.parse(storedValue);
        const parsedValue = schema.parse(rawValue);
        if (!equal(rawValue, parsedValue)) {
          this.setItem(key, parsedValue);
        }
        return parsedValue;
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

export function createAsyncZodStorage<Input, Output>(
  schema: z.ZodType<Output, Input>,
  storage: AsyncStringStorage,
): AsyncStorage<Output> {
  return {
    async getItem(key, initialValue) {
      try {
        const storedValue = await storage.getItem(key);
        if (storedValue === null) {
          return initialValue;
        }
        const rawValue = JSON.parse(storedValue);
        const res = schema.safeParse(rawValue);
        if (res.success) {
          if (!equal(rawValue, res.data)) {
            await this.setItem(key, res.data);
          }
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
