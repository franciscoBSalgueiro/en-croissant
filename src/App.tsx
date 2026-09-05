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
import { Notifications, notifications } from "@mantine/notifications";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { getMatches } from "@tauri-apps/plugin-cli";
import { listen } from "@tauri-apps/api/event";
import { attachConsole, error, info, warn } from "@tauri-apps/plugin-log";
import { getDefaultStore, useAtom, useAtomValue, useSetAtom } from "jotai";
import { ContextMenuProvider } from "mantine-contextmenu";
import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import type { Tab } from "@/utils/tabs";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  activeTabAtom,
  databaseConversionStateAtom,
  fontSizeAtom,
  pieceSetAtom,
  primaryColorAtom,
  referenceDbAtom,
  spellCheckAtom,
  storedDatabasesDirAtom,
  storedDocumentDirAtom,
  storedEnginesDirAtom,
  storedPuzzlesDirAtom,
  tabsAtom,
  telemetryEnabledAtom,
} from "./state/atoms";

import "@/styles/chessgroundBaseOverride.css";
import "@/styles/chessgroundColorsOverride.css";

import "@mantine/charts/styles.css";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";

import "mantine-contextmenu/styles.css";
import "mantine-datatable/styles.css";

import "@/styles/global.css";

import { commands } from "./bindings";
import { openFile } from "./utils/files";
import { getGameFromUrl } from "./utils/import";
import { createTab } from "./utils/tabs";
import { parsePGN } from "./utils/chess";
import { getGameName } from "./utils/treeReducer";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme",
});

import { getVersion } from "@tauri-apps/api/app";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import ErrorComponent from "@/components/ErrorComponent";
import { getDatabasesDir, getDocumentDir, getEnginesDir, getPuzzlesDir } from "@/utils/directories";
import { initUserAgent } from "@/utils/http";
import { routeTree } from "./routeTree.gen";

export type Dirs = {
  documentDir: string;
  databasesDir: string;
  enginesDir: string;
  puzzlesDir: string;
};

const router = createRouter({
  routeTree,
  defaultErrorComponent: ErrorComponent,
  context: {
    loadDirs: async () => {
      const store = getDefaultStore();

      const documentDir = await getDocumentDir();
      const databasesDir = await getDatabasesDir();
      const enginesDir = await getEnginesDir();
      const puzzlesDir = await getPuzzlesDir();

      if (!store.get(storedDocumentDirAtom)) {
        store.set(storedDocumentDirAtom, documentDir);
      }

      if (!store.get(storedDatabasesDirAtom)) {
        store.set(storedDatabasesDirAtom, databasesDir);
      }

      if (!store.get(storedEnginesDirAtom)) {
        store.set(storedEnginesDirAtom, enginesDir);
      }

      if (!store.get(storedPuzzlesDirAtom)) {
        store.set(storedPuzzlesDirAtom, puzzlesDir);
      }

      return {
        documentDir,
        databasesDir,
        enginesDir,
        puzzlesDir,
      } as Dirs;
    },
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

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
  } catch (e) {
    error(`Failed to check for updates: ${e}`);
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

const handleDeepLink = async (
  urlStr: string,
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  setActiveTab: React.Dispatch<React.SetStateAction<string | null>>,
) => {
  let notificationShown = false;
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "encroissant:") return;

    if (url.host === "import") {
      const gameUrl = url.searchParams.get("url");
      if (!gameUrl) {
        throw new Error("No URL parameter provided in encroissant://import");
      }

      notifications.show({
        title: "Importing game",
        message: `Loading game from ${gameUrl}...`,
        loading: true,
        autoClose: false,
        id: "importing-game-link",
      });
      notificationShown = true;

      const pgn = await getGameFromUrl(gameUrl);
      if (!pgn) {
        throw new Error("No PGN data found");
      }

      const tree = await parsePGN(pgn);
      const name = getGameName(tree.headers);

      await createTab({
        tab: {
          name,
          type: "analysis",
        },
        setTabs,
        setActiveTab,
        pgn,
      });

      notifications.update({
        id: "importing-game-link",
        title: "Import successful",
        message: "Game imported successfully",
        color: "green",
        autoClose: 3000,
        loading: false,
      });
    }
  } catch (e) {
    error(`Failed to handle deep link URL: ${urlStr} - ${e}`);
    const errorMessage = e instanceof Error ? e.message : String(e);
    if (notificationShown) {
      notifications.update({
        id: "importing-game-link",
        title: "Import failed",
        message: errorMessage,
        color: "red",
        autoClose: 5000,
        loading: false,
      });
    } else {
      notifications.show({
        title: "Import error",
        message: errorMessage,
        color: "red",
      });
    }
  }
};

function useAppStartup() {
  const initialized = useRef(false);
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const startupSequence = async () => {
      await commands.closeSplashscreen();
      await initUserAgent();

      const detach = await attachConsole();
      info("React app started successfully");

      checkForUpdates();

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
        warn(`Failed to parse CLI args: ${e}`);
      }

      await preloadReferenceDb(store);

      let unlistenDeepLink: (() => void) | undefined;
      try {
        const initialUrls = await getCurrent();
        if (initialUrls && initialUrls.length > 0) {
          for (const url of initialUrls) {
            void handleDeepLink(url, setTabs, setActiveTab);
          }
        }

        unlistenDeepLink = await onOpenUrl((urls) => {
          for (const url of urls) {
            void handleDeepLink(url, setTabs, setActiveTab);
          }
        });
      } catch (e) {
        warn(`Failed to setup deep links: ${e}`);
      }

      return () => {
        if (detach) detach();
        if (unlistenDeepLink) unlistenDeepLink();
      };
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

export default function App() {
  const primaryColor = useAtomValue(primaryColorAtom);
  const pieceSet = useAtomValue(pieceSetAtom);
  const fontSize = useAtomValue(fontSizeAtom);
  const spellCheck = useAtomValue(spellCheckAtom);
  const setDatabaseConversionState = useSetAtom(databaseConversionStateAtom);

  useAppStartup();

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<[number, number, string | null]>("convert_progress", (event) => {
      const [totalGames, elapsedMs, sourceFileName] = event.payload;
      setDatabaseConversionState((prev) => ({
        ...prev,
        inProgress: true,
        totalGames,
        elapsedSeconds: elapsedMs / 1000,
        sourceFileName: sourceFileName ?? prev.sourceFileName,
      }));
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [setDatabaseConversionState]);

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
