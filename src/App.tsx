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

import {
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  redirect,
  useRouteError,
} from "react-router-dom";
import { useEffect } from "react";
import DatabasesPage from "./components/databases/DatabasesPage";
import { useAtom, useAtomValue } from "jotai";
import {
  activeTabAtom,
  fontSizeAtom,
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

import "mantine-datatable/styles.css";

import "@/styles/global.css";

import { commands } from "./bindings";
import TopBar from "./components/TopBar";
import { openFile } from "./utils/files";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme",
});

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path="/"
      element={
        <AppShell
          navbar={{
            width: "3rem",
            breakpoint: "lg",
          }}
          header={{
            height: "2.5rem",
          }}
          styles={{
            main: {
              height: "100vh",
              userSelect: "none",
            },
          }}
        >
          <AppShell.Header>
            <TopBar />
          </AppShell.Header>
          <AppShell.Navbar>
            <SideBar />
          </AppShell.Navbar>
          <AppShell.Main>
            <Outlet />
          </AppShell.Main>
        </AppShell>
      }
      errorElement={<ErrorBoundary />}
    >
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
    </Route>
  )
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
