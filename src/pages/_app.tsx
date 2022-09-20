import {
  AppShell,
  Header,
  MantineProvider
} from "@mantine/core";
import type { AppProps } from "next/app";
import { SideBar } from "../components/Sidebar";

// This default export is required in a new `pages/_app.js` file.
export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider
      withGlobalStyles
      withNormalizeCSS
      theme={{
        colorScheme: "dark",
      }}
    >
      <AppShell
        padding="md"
        navbar={
          <SideBar />
        }
        header={
          <Header height={60} p="xs">
            {/* Header content */}
          </Header>
        }
        styles={(theme) => ({
          main: {
            backgroundColor:
              theme.colorScheme === "dark"
                ? theme.colors.dark[8]
                : theme.colors.gray[0],
          },
        })}
      >
        <Component {...pageProps} />;
      </AppShell>
    </MantineProvider>
  );
}
