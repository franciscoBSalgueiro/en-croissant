import {
  ActionIcon,
  Autocomplete,
  Input,
  MantineProvider,
  TextInput,
  Textarea,
  localStorageColorSchemeManager,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getMatches } from "@tauri-apps/plugin-cli";
import { attachConsole, info } from "@tauri-apps/plugin-log";
import { getDefaultStore, useAtom, useAtomValue } from "jotai";
import { ContextMenuProvider } from "mantine-contextmenu";
import { useEffect } from "react";
import { Helmet } from "react-helmet";
import {
  activeTabAtom,
  enginesAtom,
  persistEnginesAtom,
  fontSizeAtom,
  nativeBarAtom,
  pieceSetAtom,
  primaryColorAtom,
  spellCheckAtom,
  storedDocumentDirAtom,
  tabsAtom,
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
import { getBundledStockfishPath, requiredEngineSettings, saveEngines, type LocalEngine } from "@/utils/engines";
import { openFile } from "./utils/files";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme",
});

import ErrorComponent from "@/components/ErrorComponent";
import { documentDir, resolve } from "@tauri-apps/api/path";
import { routeTree } from "./routeTree.gen";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export type Dirs = {
  documentDir: string;
};

const router = createRouter({
  routeTree,
  defaultErrorComponent: ErrorComponent,
  context: {
    loadDirs: async () => {
      const store = getDefaultStore();
      const doc =
        store.get(storedDocumentDirAtom) ||
        (await resolve(await documentDir(), "EnCroissant"));
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
  const [engines, setEngines] = useAtom(enginesAtom);
  const persist = getDefaultStore().get(persistEnginesAtom) as any;

  useEffect(() => {
    (async () => {
      await commands.closeSplashscreen();
      const detach = await attachConsole();
      info("React app started successfully");

      // Auto-install bundled Stockfish at startup (if present)
      try {
        const bundled = await getBundledStockfishPath();
        if (bundled) {
          const exists = engines.some(
            (e: any) => e.type === "local" && (e as LocalEngine).path === bundled,
          );
          if (!exists) {
            try { await commands.setFileAsExecutable(bundled); } catch {}
            const config = await commands.getEngineConfig(bundled);
            if (config.status === "ok") {
              const opts = config.data.options;
              const newEngine: LocalEngine = {
                type: "local",
                name: "Stockfish",
                version: "Bundled",
                path: bundled,
                image: "",
                elo: 3635,
                loaded: true,
                settings: opts
                  .filter((o: any) => requiredEngineSettings.includes(o.value.name) && "default" in o.value)
                  .map((o: any) => ({ name: o.value.name, value: (o.value as any).default })),
              };
              const updated = [...engines, newEngine];
              setEngines(updated);
              await saveEngines(updated as any);
              try { await (persist as any)(updated as any); } catch {}
              info("Auto-installed bundled Stockfish engine at startup");
            }
          }
        }
      } catch {}

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

  return (
    <>
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
                // @ts-ignore
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
        <DndProvider backend={HTML5Backend}>
          <ContextMenuProvider>
            <Notifications />
            <RouterProvider router={router} />
          </ContextMenuProvider>
        </DndProvider>
      </MantineProvider>
    </>
  );
}
