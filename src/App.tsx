import {
  Anchor,
  AppShell,
  Button,
  Code,
  ColorScheme,
  ColorSchemeProvider,
  CopyButton,
  Group,
  MantineProvider,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { SideBar } from "./components/Sidebar";
import { Helmet } from "react-helmet";
import { useLocalStorage } from "@mantine/hooks";
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
import { commands } from "./bindings";
import TopBar from "./components/TopBar";
import { openFile } from "./utils/files";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path="/"
      element={
        <AppShell
          navbar={<SideBar />}
          header={<TopBar />}
          styles={(theme) => ({
            main: {
              height: "100vh",
              userSelect: "none",
              backgroundColor:
                theme.colorScheme === "dark"
                  ? theme.colors.dark[8]
                  : theme.colors.gray[0],
            },
          })}
        >
          <Outlet />
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
    <Stack pt="md">
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
  const [colorScheme, setColorScheme] = useLocalStorage<ColorScheme>({
    key: "mantine-color-scheme",
    defaultValue: "dark",
  });
  const primaryColor = useAtomValue(primaryColorAtom);
  const toggleColorScheme = (value?: ColorScheme) =>
    setColorScheme(value || (colorScheme === "dark" ? "light" : "dark"));
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
    <ColorSchemeProvider
      colorScheme={colorScheme}
      toggleColorScheme={toggleColorScheme}
    >
      <Helmet>
        <link rel="stylesheet" href={`/pieces/${pieceSet}.css`} />
      </Helmet>
      <MantineProvider
        withGlobalStyles
        withNormalizeCSS
        theme={{
          colorScheme,
          primaryColor,
          globalStyles: (theme) => ({
            "cg-board": {
              "square.last-move": {
                background: theme.fn.rgba(
                  theme.colors[theme.primaryColor][
                    theme.colorScheme === "dark" ? 5 : 3
                  ],
                  0.4
                ),
              },
              "square.selected": {
                backgroundColor: theme.fn.rgba(
                  theme.colors[theme.primaryColor][
                    theme.colorScheme === "dark" ? 5 : 3
                  ],
                  0.5
                ),
              },
              "square.move-dest": {
                backgroundColor: theme.fn.rgba(theme.black, 0.3),
                borderRadius: "50%",
                padding: "4%",
                backgroundClip: "content-box",
                boxSizing: "border-box",
                ":hover": {
                  backgroundColor: theme.fn.rgba(
                    theme.colors[theme.primaryColor][
                      theme.colorScheme === "dark" ? 5 : 3
                    ],
                    0.6
                  ),
                  borderRadius: 0,
                  padding: 0,
                },
              },
              "square.oc.move-dest": {
                background: "none",
                border: `5px solid ${theme.fn.rgba(theme.black, 0.3)}`,
                borderRadius: 0,
                ":hover": {
                  background: theme.fn.rgba(
                    theme.colors[theme.primaryColor][
                      theme.colorScheme === "dark" ? 5 : 3
                    ],
                    0.6
                  ),
                  borderRadius: 0,
                },
              },
            },
          }),
        }}
      >
        <Notifications />

        <RouterProvider router={router} />
      </MantineProvider>
    </ColorSchemeProvider>
  );
}
