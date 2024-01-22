import {
  ActionIcon,
  Anchor,
  AppShell,
  Button,
  Code,
  CopyButton,
  Group,
  MantineProvider,
  Stack,
  Text,
  Title,
  localStorageColorSchemeManager,
} from "@mantine/core";
import { SideBar } from "./components/Sidebar";
import { Helmet } from "react-helmet";
import { Notifications } from "@mantine/notifications";
import SettingsPage from "@/components/settings/SettingsPage";
import FilesPage from "@/components/files/FilesPage";
import EnginesPage from "@/components/engines/EnginesPage";
import BoardsPage from "@/components/tabs/BoardsPage";
import DatabaseView from "@/components/databases/DatabaseView";
import HomePage from "@/components/home/HomePage";
import { getVersion } from "@tauri-apps/api/app";
import { attachConsole } from "tauri-plugin-log-api";
import { getMatches } from "@tauri-apps/api/cli";
import { appWindow } from "@tauri-apps/api/window";

import {
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  redirect,
  useNavigate,
  useRouteError,
} from "react-router-dom";
import { useEffect, useState } from "react";
import DatabasesPage from "./components/databases/DatabasesPage";
import { useAtom, useAtomValue } from "jotai";
import { ask, message, open } from "@tauri-apps/api/dialog";
import {
  activeTabAtom,
  fontSizeAtom,
  nativeBarAtom,
  pieceSetAtom,
  primaryColorAtom,
  tabsAtom,
} from "./atoms/atoms";

import "@/styles/chessgroundBaseOverride.css";
import "@/styles/chessgroundColorsOverride.css";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/tiptap/styles.css";
import "@mantine/charts/styles.css";

import "mantine-datatable/styles.css";

import "@/styles/global.css";

import { commands } from "./bindings";
import TopBar from "./components/TopBar";
import { openFile } from "./utils/files";
import { useHotkeys } from "react-hotkeys-hook";
import { keyMapAtom } from "./atoms/keybinds";
import { createTab } from "./utils/tabs";
import { listen } from "@tauri-apps/api/event";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import AboutModal from "./components/About";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme",
});

type MenuAction = {
  id?: string;
  label: string;
  shortcut?: string;
  action?: () => void;
};

type MenuGroup = {
  label: string;
  options: MenuAction[];
};

function RootLayout() {
  const isNative = useAtomValue(nativeBarAtom);
  const navigate = useNavigate();

  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);

  async function openNewFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PGN file", extensions: ["pgn"] }],
    });
    if (typeof selected === "string") {
      navigate("/boards");
      openFile(selected, setTabs, setActiveTab);
    }
  }

  function createNewTab() {
    navigate("/boards");
    createTab({
      tab: { name: "New Tab", type: "new" },
      setTabs,
      setActiveTab,
    });
  }

  async function checkForUpdates() {
    const res = await checkUpdate();
    if (res.shouldUpdate) {
      const yes = await ask("Do you want to install them now?", {
        title: "New version available",
      });
      if (yes) {
        await installUpdate();
      }
    } else {
      await message("No updates available");
    }
  }

  const [keyMap] = useAtom(keyMapAtom);

  useHotkeys(keyMap.NEW_TAB.keys, createNewTab);
  useHotkeys(keyMap.OPEN_FILE.keys, openNewFile);
  const [opened, setOpened] = useState(false);

  const menuActions: MenuGroup[] = [
    {
      label: "File",
      options: [
        {
          label: "New Tab",
          id: "new_tab",
          shortcut: keyMap.NEW_TAB.keys,
          action: createNewTab,
        },
        {
          label: "Open File",
          id: "open_file",
          shortcut: keyMap.OPEN_FILE.keys,
          action: openNewFile,
        },
        {
          label: "Exit",
          id: "exit",
          action: () => appWindow.close(),
        },
      ],
    },
    {
      label: "View",
      options: [
        {
          label: "Reload",
          id: "reload",
          shortcut: "Ctrl+R",
          action: () => location.reload(),
        },
      ],
    },
    {
      label: "Help",
      options: [
        {
          label: "Clear saved data",
          id: "clear_saved_data",
          action: () => {
            ask("Are you sure you want to clear all saved data?", {
              title: "Clear data",
            }).then((res) => {
              if (res) {
                localStorage.clear();
                sessionStorage.clear();
                location.reload();
              }
            });
          },
        },
        { label: "divider" },
        {
          label: "Check for updates",
          id: "check_for_updates",
          action: checkForUpdates,
        },
        {
          label: "About",
          id: "about",
          action: () => setOpened(true),
        },
      ],
    },
  ];

  useEffect(() => {
    (async () => {
      const unlisten = await listen("tauri://menu", async ({ payload }) => {
        const action = menuActions
          .flatMap((group) => group.options)
          .find((action) => action.id === payload);
        if (action) {
          action.action?.();
        }
      });

      return () => {
        unlisten();
      };
    })();
  }, []);

  return (
    <AppShell
      navbar={{
        width: "3rem",
        breakpoint: 0,
      }}
      header={
        isNative
          ? undefined
          : {
              height: "2.5rem",
            }
      }
      styles={{
        main: {
          height: "100vh",
          userSelect: "none",
        },
      }}
    >
      <AboutModal opened={opened} setOpened={setOpened} />
      {!isNative && (
        <AppShell.Header>
          <TopBar menuActions={menuActions} />
        </AppShell.Header>
      )}
      <AppShell.Navbar>
        <SideBar />
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<RootLayout />} errorElement={<ErrorBoundary />}>
      <Route index element={<HomePage />} errorElement={<ErrorBoundary />} />
      <Route
        path="settings"
        element={<SettingsPage />}
        loader={async () => {
          return getVersion();
        }}
        errorElement={<ErrorBoundary />}
      />
      <Route
        path="files"
        element={<FilesPage />}
        errorElement={<ErrorBoundary />}
      />
      <Route
        path="databases"
        element={<DatabasesPage />}
        errorElement={<ErrorBoundary />}
        loader={async () => {
          const db = sessionStorage.getItem("database-view");
          if (db !== null && db !== "null") {
            return redirect("/databases/view");
          }
          return null;
        }}
      />

      <Route
        path="databases/view"
        element={<DatabaseView />}
        errorElement={<ErrorBoundary />}
      />
      <Route
        path="engines"
        element={<EnginesPage />}
        errorElement={<ErrorBoundary />}
      />
      <Route
        path="boards"
        element={<BoardsPage />}
        errorElement={<ErrorBoundary />}
      />
    </Route>,
  ),
);

function ErrorBoundary() {
  const error = useRouteError();

  return (
    <Stack p="md">
      <Title>An error ocurred</Title>
      {error instanceof Error && (
        <>
          <Text>
            <b>{error.name}:</b> {error.message}
          </Text>
          <Code>{error.stack}</Code>
          {error.cause}
        </>
      )}
      <Group>
        {error instanceof Error && (
          <CopyButton value={error.message + "\n" + error.stack}>
            {({ copied, copy }) => (
              <Button color={copied ? "teal" : undefined} onClick={copy}>
                {copied ? "Copied" : "Copy stack strace"}
              </Button>
            )}
          </CopyButton>
        )}
        <Button
          onClick={() =>
            router.navigate("/").then(() => window.location.reload())
          }
        >
          Reload
        </Button>
      </Group>

      <Text>
        Please report this on{" "}
        <Anchor
          href="https://github.com/franciscoBSalgueiro/en-croissant/issues/new?assignees=&labels=bug&projects=&template=bug.yml"
          target="_blank"
        >
          Github
        </Anchor>{" "}
        or on the{" "}
        <Anchor href="https://discord.com/invite/tdYzfDbSSW" target="_blank">
          Discord server
        </Anchor>
      </Text>
    </Stack>
  );
}

export default function App() {
  const primaryColor = useAtomValue(primaryColorAtom);
  const pieceSet = useAtomValue(pieceSetAtom);
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const isNative = useAtomValue(nativeBarAtom);

  useEffect(() => {
    commands.setMenuVisisble(isNative);
  }, [isNative]);

  useEffect(() => {
    (async () => {
      await commands.closeSplashscreen();
      const detach = await attachConsole();

      const matches = await getMatches();
      if (matches.args["file"].occurrences > 0) {
        if (typeof matches.args["file"].value !== "string") return;
        const file = matches.args["file"].value;
        router.navigate("/boards", { replace: true });
        openFile(file, setTabs, setActiveTab);
      }

      return () => {
        detach();
      };
    })();
  }, []);

  const fontSize = useAtomValue(fontSizeAtom);

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
        <Notifications />
        <RouterProvider router={router} />
      </MantineProvider>
    </>
  );
}
