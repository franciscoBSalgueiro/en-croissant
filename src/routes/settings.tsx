import SettingsPage from "@/components/settings/SettingsPage";
import { createFileRoute } from "@tanstack/react-router";
import { getVersion } from "@tauri-apps/api/app";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  loader: async ({ context: { loadDirs } }) => ({
    dirs: await loadDirs(),
    version: await getVersion(),
  }),
});
