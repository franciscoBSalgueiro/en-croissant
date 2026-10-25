/// <reference types="vitest/config" />
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import * as os from "node:os";

const isDebug = !!process.env.TAURI_ENV_DEBUG;
const host = process.env.TAURI_DEV_HOST;

// Tauri CLI sets TAURI_ENV_PLATFORM to the platform being *targeted*, which is what
// platform-specific UI cares about. Bare `vite`/`vitest` runs have no Tauri env, so
// fall back to the host. Values are normalised to node's `process.platform` spelling.
const PLATFORM_ALIASES: Record<string, string> = {
    windows: "win32",
    macos: "darwin",
};

function targetPlatform() {
    const platform = process.env.TAURI_ENV_PLATFORM;
    return platform ? (PLATFORM_ALIASES[platform] ?? platform) : os.platform();
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        tanstackRouter({
            target: "react",
        }),
        react({ compiler: true }),
    ],
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                  protocol: "ws",
                  host,
                  port: 1421,
              }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
    },
    build: {
        minify: isDebug ? false : "esbuild",
        sourcemap: isDebug ? "inline" : false,
        target: process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
    },
    resolve: {
        alias: {
            "@": resolve(import.meta.dirname, "./src"),
        },
    },
    test: {
        environment: "jsdom",
    },
    define: {
        "import.meta.env.VITE_PLATFORM": JSON.stringify(targetPlatform()),
    },
});
