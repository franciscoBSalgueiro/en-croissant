import { activeTabAtom, tabsAtom } from "@/atoms/atoms";
import { openFile } from "@/utils/files";
import {
  Box,
  Button,
  Center,
  Flex,
  Group,
  Header,
  Menu,
  createStyles,
  Text,
} from "@mantine/core";
import { ask, message, open } from "@tauri-apps/api/dialog";
import { appWindow } from "@tauri-apps/api/window";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import AboutModal from "./About";
import { useState } from "react";
import { createTab } from "@/utils/tabs";
import { useHotkeys } from "@mantine/hooks";

function IconMinimize() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      transform="scale(0.8)"
    >
      <path d="M19 13H5v-2h14v2z" fill="currentColor" />
    </svg>
  );
}

function IconMaximize() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      transform="scale(0.8)"
    >
      <path d="M19 5H5v14h14V5zm-2 12H7V7h10v10z" fill="currentColor" />
    </svg>
  );
}

function IconX() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      transform="scale(0.8)"
    >
      <path
        d="M19 6.41l-1.41-1.41L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        fill="currentColor"
      />
    </svg>
  );
}

const useStyles = createStyles((theme) => ({
  icon: {
    transition: "background-color 100ms ease",
    "&:hover": {
      backgroundColor: theme.colors.dark[5],
    },
  },
  close: {
    transition: "background-color 100ms ease",
    "&:hover": {
      backgroundColor: theme.colors.red[7],
      color: theme.white,
    },
  },
}));

type MenuAction = {
  label: string;
  shortcut?: string;
  action?: () => void;
};

type MenuGroup = {
  label: string;
  options: MenuAction[];
};

function TopBar() {
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const navigate = useNavigate();

  async function openNewFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PGN file", extensions: ["pgn"] }],
    });
    if (typeof selected === "string") {
      navigate("/boards");
      openFile(selected, setTabs, setActiveTab);
    }
  }

  function createNewTab() {
    navigate("/boards");
    createTab({
      tab: { name: "New Tab", type: "new" },
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

  const menuActions: MenuGroup[] = [
    {
      label: "File",
      options: [
        {
          label: "New Tab",
          shortcut: "Ctrl+T",
          action: createNewTab,
        },
        {
          label: "Open File",
          shortcut: "Ctrl+O",
          action: openNewFile,
        },
        {
          label: "Exit",
          action: () => appWindow.close(),
        },
      ],
    },
    {
      label: "View",
      options: [
        {
          label: "Reload",
          shortcut: "Ctrl+R",
          action: () => location.reload(),
        },
      ],
    },
    {
      label: "Help",
      options: [
        {
          label: "Clear saved data",
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
        { label: "divider" },
        {
          label: "Check for updates",
          action: checkForUpdates,
        },
        {
          label: "About",
          action: () => setOpened(true),
        },
      ],
    },
  ];
  const { classes } = useStyles();
  const [opened, setOpened] = useState(false);

  useHotkeys([
    ["ctrl+T", createNewTab],
    ["ctrl+O", openNewFile],
  ]);

  return (
    <>
      <Header height={35} zIndex={1000}>
        <Flex h={35} align="end">
          <Box sx={{ flexGrow: 1 }} p={5}>
            <Group data-tauri-drag-region>
              <img src="/logo.png" width={20} height={20} />
              <Group spacing={0}>
                {menuActions.map((action) => (
                  <Menu
                    key={action.label}
                    shadow="md"
                    width={200}
                    position="bottom-start"
                    transitionProps={{ duration: 0 }}
                  >
                    <Menu.Target>
                      <Button
                        sx={{
                          ":active": {
                            transform: "none",
                          },
                        }}
                        variant="subtle"
                        color="gray"
                        compact
                      >
                        {action.label}
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {action.options.map((option, i) =>
                        option.label === "divider" ? (
                          <Menu.Divider key={i} />
                        ) : (
                          <Menu.Item
                            key={option.label}
                            rightSection={
                              option.shortcut && (
                                <Text size="xs" color="dimmed">
                                  {option.shortcut}
                                </Text>
                              )
                            }
                            onClick={option.action}
                          >
                            {option.label}
                          </Menu.Item>
                        )
                      )}
                    </Menu.Dropdown>
                  </Menu>
                ))}
              </Group>
            </Group>
          </Box>
          <Box h={35}>
            <Group spacing={0} data-tauri-drag-region>
              <Center
                h={35}
                w={45}
                onClick={() => appWindow.minimize()}
                className={classes.icon}
              >
                <IconMinimize />
              </Center>
              <Center
                h={35}
                w={45}
                onClick={() => appWindow.toggleMaximize()}
                className={classes.icon}
              >
                <IconMaximize />
              </Center>
              <Center
                h={35}
                w={45}
                onClick={() => appWindow.close()}
                className={classes.close}
              >
                <IconX />
              </Center>
            </Group>
          </Box>
        </Flex>
      </Header>
      <AboutModal opened={opened} setOpened={setOpened} />
    </>
  );
}

export default TopBar;
