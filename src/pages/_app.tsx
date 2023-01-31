import {
  AppShell,
  ColorScheme,
  ColorSchemeProvider,
  MantineColor,
  MantineProvider
} from "@mantine/core";
import { NotificationsProvider } from "@mantine/notifications";
import type { AppProps } from "next/app";
import { SideBar } from "../components/Sidebar";

// Chessground styles
// import "chessground/assets/chessground.brown.css";
import { useLocalStorage } from "@mantine/hooks";
import "chessground/assets/chessground.cburnett.css";
import Head from "next/head";
import "../styles/chessgroundBaseOverride.css";
import "../styles/chessgroundColorsOverride.css";
import "../styles/chessgroundPiecesOverride.css";

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
      </Head>
      <MantineProvider
        withGlobalStyles
        withNormalizeCSS
        theme={{
          colorScheme,
          primaryColor,
        }}
      >
        <NotificationsProvider>
          <AppShell
            // padding="md"
            navbar={<SideBar />}
            styles={(theme) => ({
              main: {
                overflow: "hidden",
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
        </NotificationsProvider>
      </MantineProvider>
    </ColorSchemeProvider>
  );
}
