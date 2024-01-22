import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { invoke as invokeTauri } from "@tauri-apps/api";
import { error } from "tauri-plugin-log-api";

export async function invoke<T>(
  name: string,
  payload?: Record<string, unknown>,
  allowedErrors?: (s: string) => boolean,
): Promise<T> {
  try {
    return await invokeTauri<T>(name, payload);
  } catch (e) {
    if (typeof e === "string") {
      if (allowedErrors?.(e)) {
        return Promise.reject(e);
      }
      error(e);
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

type Result<T, E> = { status: "ok"; data: T } | { status: "error"; error: E };

export function unwrap<T>(result: Result<T, string>): T {
  if (result.status === "ok") {
    return result.data;
  }
  error(result.error);
  notifications.show({
    title: "Error",
    message: result.error,
    color: "red",
    icon: <IconX />,
  });
  throw result.error;
}
