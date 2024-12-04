/// <reference types="vitest" />
import { resolve } from "node:path";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import { defineConfig } from "vite";

const isDebug = !!process.env.TAURI_ENV_DEBUG;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), vanillaExtractPlugin(), TanStackRouterVite()],
  server: {
    port: 1420,
  },
  build: {
    minify: isDebug ? false : "esbuild",
    sourcemap: isDebug ? "inline" : false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  resolve: {
    alias: [{ find: "@", replacement: resolve(__dirname, "./src") }],
  },
  test: {
    environment: "jsdom",
  },
});
