import {
  AppShell,
  ColorScheme,
  ColorSchemeProvider,
  MantineColor,
  MantineProvider,
} from "@mantine/core";
import type { AppProps } from "next/app";
import { SideBar } from "../components/Sidebar";

// Chessground styles
import { useLocalStorage } from "@mantine/hooks";
import { Notifications } from "@mantine/notifications";
import Head from "next/head";
import "../styles/chessgroundBaseOverride.css";
import "../styles/chessgroundColorsOverride.css";

// This default export is required in a new `pages/_app.js` file.
export default function MyApp({ Component, pageProps }: AppProps) {
  const [colorScheme, setColorScheme] = useLocalStorage<ColorScheme>({
    key: "mantine-color-scheme",
    defaultValue: "dark",
  });
  const [primaryColor, _] = useLocalStorage<MantineColor>({
    key: "mantine-primary-color",
    defaultValue: "blue",
  });
  const toggleColorScheme = (value?: ColorScheme) =>
    setColorScheme(value || (colorScheme === "dark" ? "light" : "dark"));

  const [pieceSet] = useLocalStorage({
    key: "piece-set",
    defaultValue: "staunty",
  });

  return (
    <ColorSchemeProvider
      colorScheme={colorScheme}
      toggleColorScheme={toggleColorScheme}
    >
      <Head>
        <title>Page title</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
        <link rel="stylesheet" href={`/pieces/${pieceSet}.css`} />
      </Head>
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
        <AppShell
          navbar={<SideBar />}
          styles={(theme) => ({
            main: {
              overflow: "hidden",
              paddingRight: 10,
              userSelect: "none",
              backgroundColor:
                theme.colorScheme === "dark"
                  ? theme.colors.dark[8]
                  : theme.colors.gray[0],
            },
          })}
        >
          <Component {...pageProps} />
        </AppShell>
      </MantineProvider>
    </ColorSchemeProvider>
  );
}
