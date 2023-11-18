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
import { open } from "@tauri-apps/api/dialog";
import { appWindow } from "@tauri-apps/api/window";
import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";

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

function TopBar() {
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const navigate = useNavigate();
  const menuActions = [
    {
      label: "File",
      options: [
        {
          label: "Open File",
          shortcut: "Ctrl+O",
          action: async () => {
            const selected = await open({
              multiple: false,
              filters: [{ name: "PGN file", extensions: ["pgn"] }],
            });
            if (typeof selected === "string") {
              navigate("/boards");
              openFile(selected, setTabs, setActiveTab);
            }
          },
        },
        {
          label: "Gallery",
        },
        {
          label: "Search",
          shortcut: "⌘K",
        },
        {
          label: "Transfer my data",
        },
        {
          label: "Delete my account",
        },
      ],
    },
    {
      label: "Edit",
      options: [
        {
          label: "Undo",
          shortcut: "Ctrl+Z",
        },
        {
          label: "Redo",
          shortcut: "Ctrl+Y",
        },
        {
          label: "Cut",
          shortcut: "Ctrl+X",
        },
        {
          label: "Copy",
          shortcut: "Ctrl+C",
        },
        {
          label: "Paste",
          shortcut: "Ctrl+V",
        },
        {
          label: "Select all",
          shortcut: "Ctrl+A",
        },
      ],
    },
    {
      label: "View",
      options: [
        {
          label: "Reload",
          shortcut: "Ctrl+R",
        },
        {
          label: "Toggle full screen",
          shortcut: "F11",
        },
        {
          label: "Toggle developer tools",
          shortcut: "Ctrl+Shift+I",
        },
      ],
    },
    {
      label: "Help",
      options: [
        {
          label: "About",
        },
      ],
    },
  ];
  const { classes } = useStyles();
  return (
    <Header height={35} data-tauri-drag-region zIndex={1000}>
      <Flex h={35} align="end">
        <Box sx={{ flexGrow: 1 }} p={5}>
          <Group>
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
                    {action.options.map((option) => (
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
                    ))}
                  </Menu.Dropdown>
                </Menu>
              ))}
            </Group>
          </Group>
        </Box>
        <Box h={35}>
          <Group spacing={0}>
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
  );
}

export default TopBar;
