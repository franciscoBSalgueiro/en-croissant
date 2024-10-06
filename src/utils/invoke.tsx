import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { error } from "@tauri-apps/plugin-log";

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
  throw new Error(result.error);
}
