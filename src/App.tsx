import { useEffect, useRef } from "react";

// UI & Styles
import {
  ActionIcon,
  Autocomplete,
  createTheme,
  Input,
  localStorageColorSchemeManager,
  MantineProvider,
  Textarea,
  TextInput,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ContextMenuProvider } from "mantine-contextmenu";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

// Routing
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// State Management
import { getDefaultStore, useAtom, useAtomValue } from "jotai";
import {
  activeTabAtom,
  fontSizeAtom,
  pieceSetAtom,
  primaryColorAtom,
  referenceDbAtom,
  spellCheckAtom,
  storedDocumentDirAtom,
  tabsAtom,
  telemetryEnabledAtom,
} from "./state/atoms";

// Tauri & System
import { getVersion } from "@tauri-apps/api/app";
import { documentDir, homeDir, resolve } from "@tauri-apps/api/path";
import { getMatches } from "@tauri-apps/plugin-cli";
import { ask } from "@tauri-apps/plugin-dialog";
import { attachConsole, info } from "@tauri-apps/plugin-log";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

// Analytics & Utils
import posthog from "posthog-js";
import { commands } from "./bindings";
import ErrorComponent from "@/components/ErrorComponent";
import { openFile } from "./utils/files";
import { initUserAgent } from "@/utils/http";

// CSS Imports
import "@mantine/charts/styles.css";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import "mantine-contextmenu/styles.css";
import "mantine-datatable/styles.css";
import "@/styles/global.css";
import "@/styles/chessgroundBaseOverride.css";
import "@/styles/chessgroundColorsOverride.css";

// --- Configuration ---

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme",
});

export type Dirs = {
  documentDir: string;
};

// --- Router Setup ---

const router = createRouter({
  routeTree,
  defaultErrorComponent: ErrorComponent,
  context: {
    loadDirs: async () => {
      const store = getDefaultStore();
      let doc = store.get(storedDocumentDirAtom);

      if (!doc) {
        try {
          const docDir = await documentDir();
          doc = await resolve(docDir, "EnCroissant");
        } catch (e) {
          const hDir = await homeDir();
          doc = await resolve(hDir, "EnCroissant");
        }
      }
      return { documentDir: doc } as Dirs;
    },
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// --- Logic Extractors ---

const checkForUpdates = async () => {
  try {
    const update = await check();
    if (update) {
      const yes = await ask("Do you want to install the new version now?", {
        title: "New version available",
      });
      if (yes) {
        await update.downloadAndInstall();
        await relaunch();
      }
    }
  } catch (error) {
    console.error("Failed to check for updates:", error);
  }
};

const preloadReferenceDb = async (store: ReturnType<typeof getDefaultStore>) => {
  const referenceDb = store.get(referenceDbAtom);
  if (referenceDb) {
    info(`Preloading reference database: ${referenceDb}`);
    commands.preloadReferenceDb(referenceDb).catch((e: unknown) => {
      info(`Failed to preload reference database: ${e}`);
    });
  }
};

// --- Hook: App Initialization ---

function useAppStartup() {
  const initialized = useRef(false);
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const startupSequence = async () => {
      // 1. Core System Init
      await commands.closeSplashscreen();
      await initUserAgent();

      // 2. Logging
      const detach = await attachConsole();
      info("React app started successfully");

      // 3. Updates
      await checkForUpdates();

      // 4. State & Analytics
      const store = getDefaultStore();
      const telemetryEnabled = store.get(telemetryEnabledAtom);

      posthog.init("phc_kgEBtifs0EgWlrl4ROYEbnsQ1b7BS2W5BKLNyXe7f8z", {
        api_host: "https://app.posthog.com",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
      });

      if (telemetryEnabled) {
        posthog.capture("app_started", { version: await getVersion() });
      }

      // 5. CLI Arguments / File Opening
      try {
        const matches = await getMatches();
        if (matches.args.file.occurrences > 0) {
          info(`Opening file from command line: ${matches.args.file.value}`);
          if (typeof matches.args.file.value === "string") {
            const file = matches.args.file.value;
            openFile(file, setTabs, setActiveTab);
          }
        }
      } catch (e) {
        console.warn("Failed to parse CLI args", e);
      }

      // 6. DB Preload
      await preloadReferenceDb(store);

      return detach;
    };

    let detachFn: (() => void) | undefined;
    startupSequence().then((fn) => {
      detachFn = fn;
    });

    return () => {
      if (detachFn) detachFn();
    };
  }, [setTabs, setActiveTab]);
}

// --- Component: App ---

export default function App() {
  const primaryColor = useAtomValue(primaryColorAtom);
  const pieceSet = useAtomValue(pieceSetAtom);
  const fontSize = useAtomValue(fontSizeAtom);
  const spellCheck = useAtomValue(spellCheckAtom);

  // Run startup logic
  useAppStartup();

  // Handle global font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  // Create theme dynamically based on state
  const theme = createTheme({
    primaryColor,
    colors: {
      dark: [
        "#C1C2C5",
        "#A6A7AB",
        "#909296",
        "#5c5f66",
        "#373A40",
        "#2C2E33",
        "#25262b",
        "#1A1B1E",
        "#141517",
        "#101113",
      ],
    },
    components: {
      ActionIcon: ActionIcon.extend({
        defaultProps: {
          variant: "transparent",
          color: "gray",
        },
      }),
      TextInput: TextInput.extend({ defaultProps: { spellCheck } }),
      Autocomplete: Autocomplete.extend({ defaultProps: { spellCheck } }),
      Textarea: Textarea.extend({ defaultProps: { spellCheck } }),
      Input: Input.extend({
        defaultProps: {
          // @ts-expect-error - Solve mantine input type check
          spellCheck,
        },
      }),
    },
  });

  return (
    <DndProvider backend={HTML5Backend}>
      <link rel="stylesheet" href={`/pieces/${pieceSet}.css`} />
      
      <MantineProvider
        colorSchemeManager={colorSchemeManager}
        defaultColorScheme="dark"
        theme={theme}
      >
        <ContextMenuProvider>
          <Notifications />
          <RouterProvider router={router} />
        </ContextMenuProvider>
      </MantineProvider>
    </DndProvider>
  );
}