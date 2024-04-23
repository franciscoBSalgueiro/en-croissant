import type { Dirs } from "@/App";
import AboutModal from "@/components/About";
import { SideBar } from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { activeTabAtom, nativeBarAtom, tabsAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { openFile } from "@/utils/files";
import { createTab } from "@/utils/tabs";
import { AppShell } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  Outlet,
  createRootRouteWithContext,
  useNavigate,
} from "@tanstack/react-router";
import { ask, message, open } from "@tauri-apps/api/dialog";
import { listen } from "@tauri-apps/api/event";
import { appLogDir, resolve } from "@tauri-apps/api/path";
import { open as shellOpen } from "@tauri-apps/api/shell";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import { appWindow } from "@tauri-apps/api/window";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";

type MenuGroup = {
  label: string;
  options: MenuAction[];
};

type MenuAction = {
  id?: string;
  label: string;
  shortcut?: string;
  action?: () => void;
};

export const Route = createRootRouteWithContext<{
  loadDirs: () => Promise<Dirs>;
}>()({
  component: RootLayout,
});

function RootLayout() {
  const isNative = useAtomValue(nativeBarAtom);
  const navigate = useNavigate();

  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);

  const { t } = useTranslation();

  async function openNewFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PGN file", extensions: ["pgn"] }],
    });
    if (typeof selected === "string") {
      navigate({ to: "/" });
      openFile(selected, setTabs, setActiveTab);
    }
  }

  function createNewTab() {
    navigate({ to: "/" });
    createTab({
      tab: { name: t("Tab.NewTab"), type: "new" },
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
      label: t("Menu.File"),
      options: [
        {
          label: t("Menu.File.NewTab"),
          id: "new_tab",
          shortcut: keyMap.NEW_TAB.keys,
          action: createNewTab,
        },
        {
          label: t("Menu.File.OpenFile"),
          id: "open_file",
          shortcut: keyMap.OPEN_FILE.keys,
          action: openNewFile,
        },
        {
          label: t("Menu.File.Exit"),
          id: "exit",
          action: () => appWindow.close(),
        },
      ],
    },
    {
      label: t("Menu.View"),
      options: [
        {
          label: t("Menu.View.Reload"),
          id: "reload",
          shortcut: "Ctrl+R",
          action: () => location.reload(),
        },
      ],
    },
    {
      label: t("Menu.Help"),
      options: [
        {
          label: t("Menu.Help.Documentation"),
          id: "documentation",
          action: () => shellOpen("https://encroissant.org/docs/"),
        },
        {
          label: t("Menu.Help.ClearSavedData"),
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
        {
          label: t("Menu.Help.OpenLogs"),
          id: "logs",
          action: async () => {
            const path = await resolve(await appLogDir(), "en-croissant.log");
            notifications.show({
              title: "Logs",
              message: `Opened logs in ${path}`,
            });
            await shellOpen(path);
          },
        },
        { label: "divider" },
        {
          label: t("Menu.Help.CheckUpdate"),
          id: "check_for_updates",
          action: checkForUpdates,
        },
        {
          label: t("Menu.Help.About"),
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
