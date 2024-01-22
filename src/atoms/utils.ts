import {
  AsyncStorage,
  AsyncStringStorage,
  SyncStorage,
  SyncStringStorage,
} from "jotai/vanilla/utils/atomWithStorage";
import {
  BaseDirectory,
  readTextFile,
  removeFile,
  writeTextFile,
} from "@tauri-apps/api/fs";

import { z } from "zod";
import { warn } from "tauri-plugin-log-api";

const options = { dir: BaseDirectory.AppData };
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
    await removeFile(key, options);
  },
};

export function createZodStorage<Value>(
  schema: z.ZodType<Value>,
  storage: SyncStringStorage,
): SyncStorage<Value> {
  return {
    getItem(key, initialValue) {
      const storedValue = storage.getItem(key);
      try {
        return schema.parse(JSON.parse(storedValue ?? ""));
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
      const storedValue = await storage.getItem(key);
      const res = schema.safeParse(JSON.parse(storedValue ?? ""));
      if (res.success) {
        return res.data;
      }
      warn(`Invalid value for ${key}: ${storedValue}\n${res.error}`);
      await this.setItem(key, initialValue);
      return initialValue;
    },
    async setItem(key, value) {
      storage.setItem(key, JSON.stringify(value, null, 4));
    },
    async removeItem(key) {
      storage.removeItem(key);
    },
  };
}
