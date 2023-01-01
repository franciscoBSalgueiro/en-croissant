import { AppShell, MantineProvider } from "@mantine/core";
import { NotificationsProvider } from "@mantine/notifications";
import type { AppProps } from "next/app";
import { SideBar } from "../components/Sidebar";

// Chessground styles
// import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import Head from "next/head";
import "../styles/chessgroundBaseOverride.css";
import "../styles/chessgroundColorsOverride.css";
import "../styles/chessgroundPiecesOverride.css";

// This default export is required in a new `pages/_app.js` file.
export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
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
          colorScheme: "dark",
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
    </>
  );
}
