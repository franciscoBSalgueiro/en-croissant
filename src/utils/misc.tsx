import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { invoke as invokeTauri } from "@tauri-apps/api";
import { BaseDirectory, readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import React, { useEffect, useState } from "react";

type StorageValue<T> = [T, React.Dispatch<React.SetStateAction<T>>];

export function useSessionStorage<T>({
  key,
  defaultValue,
}: {
  key: string;
  defaultValue: T;
}): StorageValue<T> {
  const [state, setState] = useState<T>(() => {
    const storedValue = sessionStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
  });

  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}

export function useLocalFile<T>(
  filename: string,
  defaultValue: T
): StorageValue<T> {
  const [state, setState] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    readTextFile(filename, {
      dir: BaseDirectory.AppData,
    }).then((text) => {
      setLoaded(true);
      if (text === "") {
        return;
      }
      const data = JSON.parse(text);
      setState(data);
    });
  }, [filename]);

  useEffect(() => {
    if (loaded) {
      writeTextFile(filename, JSON.stringify(state), {
        dir: BaseDirectory.AppData,
      });
    }
  }, [filename, state]);

  return [state, setState];
}

export async function invoke<T>(
  name: string,
  payload?: any,
  allowedErrors?: (s: string) => boolean
): Promise<T> {
  try {
    return await invokeTauri<T>(name, payload);
  } catch (e) {
    if (typeof e === "string") {
      if (allowedErrors && allowedErrors(e)) {
        return Promise.reject(e);
      }
      notifications.show({
        title: "Error",
        message: e,
        color: "red",
        icon: <IconX />,
      });
    }
    return Promise.reject(e);
  }
}
