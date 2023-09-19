import {
  AppShell,
  ColorScheme,
  ColorSchemeProvider,
  MantineProvider,
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

import {
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom";
import { useEffect } from "react";
import { invoke } from "./utils/invoke";
import DatabasesPage from "./components/databases/DatabasesPage";
import { useAtomValue } from "jotai";
import { pieceSetAtom, primaryColorAtom } from "./atoms/atoms";

import "react-virtualized/styles.css";
import "./styles/chessgroundBaseOverride.css";
import "./styles/chessgroundColorsOverride.css";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path="/"
      element={
        <AppShell
          navbar={<SideBar />}
          styles={(theme) => ({
            main: {
              paddingRight: 10,
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
    >
      <Route index element={<HomePage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="files" element={<FilesPage />} />
      <Route path="databases" element={<DatabasesPage />} />
      <Route path="databases/view" element={<DatabaseView />} />
      <Route path="engines" element={<EnginesPage />} />
      <Route path="boards" element={<BoardsPage />} />
    </Route>
  )
);

export default function App() {
  const [colorScheme, setColorScheme] = useLocalStorage<ColorScheme>({
    key: "mantine-color-scheme",
    defaultValue: "dark",
  });
  const primaryColor = useAtomValue(primaryColorAtom);
  const toggleColorScheme = (value?: ColorScheme) =>
    setColorScheme(value || (colorScheme === "dark" ? "light" : "dark"));
  const pieceSet = useAtomValue(pieceSetAtom);
  useEffect(() => {
    invoke("close_splashscreen");
  });

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
