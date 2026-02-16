import {
  ActionIcon,
  Autocomplete,
  Input,
  localStorageColorSchemeManager,
  MantineProvider,
  Textarea,
  TextInput,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { getMatches } from "@tauri-apps/plugin-cli";
import { attachConsole, info } from "@tauri-apps/plugin-log";
import { getDefaultStore, useAtom, useAtomValue } from "jotai";
import { ContextMenuProvider } from "mantine-contextmenu";
import posthog from "posthog-js";
import { useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Helmet } from "react-helmet";
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

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme",
});

import { getVersion } from "@tauri-apps/api/app";
import { documentDir, homeDir, resolve } from "@tauri-apps/api/path";
import ErrorComponent from "@/components/ErrorComponent";
import { initUserAgent } from "@/utils/http";
import { routeTree } from "./routeTree.gen";

export type Dirs = {
  documentDir: string;
};

const router = createRouter({
  routeTree,
  defaultErrorComponent: ErrorComponent,
  context: {
    loadDirs: async () => {
      const store = getDefaultStore();
      let doc = store.get(storedDocumentDirAtom);
      if (!doc) {
        try {
          doc = await resolve(await documentDir(), "EnCroissant");
        } catch (e) {
          doc = await resolve(await homeDir(), "EnCroissant");
        }
      }
      const dirs: Dirs = { documentDir: doc };
      return dirs;
    },
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  const primaryColor = useAtomValue(primaryColorAtom);
  const pieceSet = useAtomValue(pieceSetAtom);
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);

  useEffect(() => {
    (async () => {
      await commands.closeSplashscreen();
      await initUserAgent();
      const detach = await attachConsole();
      info("React app started successfully");

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
      const matches = await getMatches();
      if (matches.args.file.occurrences > 0) {
        info(`Opening file from command line: ${matches.args.file.value}`);
        if (typeof matches.args.file.value === "string") {
          const file = matches.args.file.value;
          openFile(file, setTabs, setActiveTab);
        }
      }

      return () => {
        detach();
      };
    })();
  }, []);

  const fontSize = useAtomValue(fontSizeAtom);
  const spellCheck = useAtomValue(spellCheckAtom);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  useEffect(() => {
    const store = getDefaultStore();
    const referenceDb = store.get(referenceDbAtom);
    if (referenceDb) {
      info(`Preloading reference database: ${referenceDb}`);
      commands.preloadReferenceDb(referenceDb).catch((e: unknown) => {
        info(`Failed to preload reference database: ${e}`);
      });
    }
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <Helmet>
        <link rel="stylesheet" href={`/pieces/${pieceSet}.css`} />
      </Helmet>
      <MantineProvider
        colorSchemeManager={colorSchemeManager}
        defaultColorScheme="dark"
        theme={{
          primaryColor,
          components: {
            ActionIcon: ActionIcon.extend({
              defaultProps: {
                variant: "transparent",
                color: "gray",
              },
            }),
            TextInput: TextInput.extend({
              defaultProps: {
                spellCheck: spellCheck,
              },
            }),
            Autocomplete: Autocomplete.extend({
              defaultProps: {
                spellCheck: spellCheck,
              },
            }),
            Textarea: Textarea.extend({
              defaultProps: {
                spellCheck: spellCheck,
              },
            }),
            Input: Input.extend({
              defaultProps: {
                // @ts-expect-error
                spellCheck: spellCheck,
              },
            }),
          },
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
        }}
      >
        <ContextMenuProvider>
          <Notifications />
          <RouterProvider router={router} />
        </ContextMenuProvider>
      </MantineProvider>
    </DndProvider>
  );
}
