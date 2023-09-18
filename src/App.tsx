import {
  AppShell,
  ColorScheme,
  ColorSchemeProvider,
  MantineColor,
  MantineProvider,
} from "@mantine/core";
import { SideBar } from "./components/Sidebar";

// Chessground styles
import { useLocalStorage } from "@mantine/hooks";
import { Notifications } from "@mantine/notifications";
import "react-virtualized/styles.css";
import "./styles/chessgroundBaseOverride.css";
import "./styles/chessgroundColorsOverride.css";

import Home from "./routes/index";
import Settings from "./routes/settings";
import Files from "./routes/files";
import Engines from "./routes/engines";
import Boards from "./routes/boards";
import DBView from "./routes/db/view";
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
      <Route index element={<Home />} />
      <Route path="settings" element={<Settings />} />
      <Route path="files" element={<Files />} />
      <Route path="databases" element={<DatabasesPage />} />
      <Route path="databases/view" element={<DBView />} />
      <Route path="engines" element={<Engines />} />
      <Route path="boards" element={<Boards />} />
    </Route>
  )
);

export default function App() {
  const [colorScheme, setColorScheme] = useLocalStorage<ColorScheme>({
    key: "mantine-color-scheme",
    defaultValue: "dark",
  });
  const [primaryColor] = useLocalStorage<MantineColor>({
    key: "mantine-primary-color",
    defaultValue: "blue",
  });
  const toggleColorScheme = (value?: ColorScheme) =>
    setColorScheme(value || (colorScheme === "dark" ? "light" : "dark"));
  const [pieceSet] = useLocalStorage({
    key: "piece-set",
    defaultValue: "staunty",
  });
  useEffect(() => {
    invoke("close_splashscreen");
  });

  return (
    <ColorSchemeProvider
      colorScheme={colorScheme}
      toggleColorScheme={toggleColorScheme}
    >
      <head>
        <link rel="stylesheet" href={`/pieces/${pieceSet}.css`} />
      </head>
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
