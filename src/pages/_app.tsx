import { AppShell, MantineProvider } from "@mantine/core";
import type { AppProps } from "next/app";
import { SideBar } from "../components/Sidebar";

// Chessground styles
// import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "../styles/chessgroundBaseOverride.css";
import "../styles/chessgroundColorsOverride.css";
import "../styles/chessgroundPiecesOverride.css";


// This default export is required in a new `pages/_app.js` file.
export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div onContextMenu={(e) => e.preventDefault()}>
      <MantineProvider
        withGlobalStyles
        withNormalizeCSS
        theme={{
          colorScheme: "dark",
        }}
      >
        <AppShell
          // padding="md"
          navbar={<SideBar />}
          styles={(theme) => ({
            main: {
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
    </div>
  );
}
