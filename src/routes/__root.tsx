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
import {
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { appLogDir, resolve } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, message, open } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { exit } from "@tauri-apps/plugin-process";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { check } from "@tauri-apps/plugin-updater";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import { match } from "ts-pattern";

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

async function createMenu(menuActions: MenuGroup[]) {
  const items = await Promise.all(
    menuActions.map(async (group) => {
      const submenuItems = await Promise.all(
        group.options.map(async (option) => {
          return match(option.label)
            .with("divider", () =>
              PredefinedMenuItem.new({
                item: "Separator",
              }),
            )
            .otherwise(() => {
              return MenuItem.new({
                id: option.id,
                text: option.label,
                accelerator: option.shortcut,
                action: option.action,
              });
            });
        }),
      );

      return Submenu.new({
        text: group.label,
        items: submenuItems,
      });
    }),
  );

  return Menu.new({
    items: items,
  });
}

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

  const openNewFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PGN file", extensions: ["pgn"] }],
    });
    if (typeof selected === "string") {
      navigate({ to: "/" });
      openFile(selected, setTabs, setActiveTab);
    }
  }, [navigate, setActiveTab, setTabs]);

  const createNewTab = useCallback(() => {
    navigate({ to: "/" });
    createTab({
      tab: { name: t("Tab.NewTab"), type: "new" },
      setTabs,
      setActiveTab,
    });
  }, [navigate, setActiveTab, setTabs, t]);

  const checkForUpdates = useCallback(async () => {
    const update = await check();
    if (update) {
      const yes = await ask("Do you want to install them now?", {
        title: "New version available",
      });
      if (yes) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } else {
      await message("No updates available");
    }
  }, []);

  const [keyMap] = useAtom(keyMapAtom);

  useHotkeys(keyMap.NEW_BOARD_TAB.keys, createNewTab);
  useHotkeys(keyMap.OPEN_FILE.keys, openNewFile);
  const [opened, setOpened] = useState(false);

  const menuActions: MenuGroup[] = useMemo(
    () => [
      {
        label: t("Menu.File"),
        options: [
          {
            label: t("Menu.File.NewTab"),
            id: "new_tab",
            shortcut: keyMap.NEW_BOARD_TAB.keys,
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
            action: () => exit(0),
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
    ],
    [t, checkForUpdates, createNewTab, keyMap, openNewFile],
  );

  const { data: menu } = useSWRImmutable(["menu", menuActions], () =>
    createMenu(menuActions),
  );

  useEffect(() => {
    if (!menu) return;
    if (isNative) {
      menu.setAsAppMenu();
      getCurrentWindow().setDecorations(true);
    } else {
      Menu.new().then((m) => m.setAsAppMenu());
      getCurrentWindow().setDecorations(false);
    }
  }, [menu, isNative]);

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
