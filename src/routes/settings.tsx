import SettingsPage from "@/components/settings/SettingsPage";
import { createFileRoute } from "@tanstack/react-router";
import { isTauri } from "@tauri-apps/api/core";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  loader: async ({ context: { loadDirs } }) => {
    let version = "0.0.0"; // Default version for development
    
    if (isTauri()) {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        version = await getVersion();
      } catch (e) {
        console.warn("Failed to get app version:", e);
      }
    }
    
    return {
      dirs: await loadDirs(),
      version,
    };
  },
});
