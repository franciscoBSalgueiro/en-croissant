import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { invoke as invokeTauri } from "@tauri-apps/api";
import { BaseDirectory, readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import React, { useEffect, useRef, useState } from "react";

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
  }, [filename, state, loaded]);

  return [state, setState];
}

export async function invoke<T>(
  name: string,
  payload?: Record<string, unknown>,
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

export function getBoardSize(height: number, width: number) {
  const initial = Math.min((height - 140) * 0.95, width * 0.4);
  if (width < 680) {
    return width - 120;
  }
  return initial;
}

export function isPrefix<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length > arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}

export const useThrottledEffect = (
  callback: () => void,
  delay: number,
  deps: React.DependencyList
) => {
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(function () {
      if (Date.now() - lastRan.current >= delay) {
        callback();
        lastRan.current = Date.now();
      }
    }, delay - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [delay, ...deps]);
};

export function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function harmonicMean(arr: number[]): number {
  const sum = arr.reduce((a, b) => a + 1 / b, 0);
  return arr.length / sum;
}
