import { getVersion } from "@tauri-apps/api/app";

const APP_NAME = "EnCroissant";
const APP_REPO = "https://github.com/franciscoBSalgueiro/en-croissant";

let userAgent = APP_NAME;

export async function initUserAgent(): Promise<void> {
  try {
    const version = await getVersion();
    userAgent = `${APP_NAME}/${version} (${APP_REPO})`;
  } catch {
    userAgent = `${APP_NAME} (${APP_REPO})`;
  }
}

export function apiHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    "User-Agent": userAgent,
    ...extra,
  };
}
